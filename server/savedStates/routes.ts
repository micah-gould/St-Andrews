// Saved-state routes with ownership, sharing, and access-request flows.
//
//   GET    /api/saved-states                            list all states the user owns or has shares in
//   POST   /api/saved-states                            create a new state (owned by current user)
//   GET    /api/saved-states/:id                        fetch a state the user can view
//   GET    /api/saved-states/:id/meta                   minimal info + requestable=true even when forbidden
//   PUT    /api/saved-states/:id                        merge/replace state (edit or higher)
//   DELETE /api/saved-states/:id                        delete state (admin/owner)
//   GET    /api/saved-states/:id/shares                 list shares + pending requests (admin/owner)
//   POST   /api/saved-states/:id/shares                 grant/update a user's role (admin/owner)
//   DELETE /api/saved-states/:id/shares/:shareId        revoke a share (admin/owner)
//   POST   /api/saved-states/:id/transfer               transfer ownership (owner only)
//   POST   /api/saved-states/:id/request-access         request access to a forbidden state
//   POST   /api/saved-states/:id/requests/:requestId    resolve a pending request (admin/owner)

import express from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../auth/prisma";
import { requireAuth } from "../auth/routes";
import {
  ROLES,
  canDelete,
  canEdit,
  canManageShares,
  canTransferOwner,
  canView,
  effectiveRole,
  isValidRole,
} from "./permissions";
import {
  countSelectionsIn,
  mergeSlice,
  normalizeSavedState,
} from "./stateShape";
import { sendAccessRequestEmail } from "./email";
import type {
  AuthedRequest,
  MaybeAuthedRequest,
} from "../../src/types/server.types";
import type {
  SavedStateBlob,
  SavedStateRecord,
  SavedStateRole,
  SavedStateShare,
  SavedStateAccessRequest,
  SavedStateMeta,
} from "../../src/types/saved-state.types";

const router = express.Router();

const APP_URL = process.env.APP_URL || "http://localhost:5174";

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const requestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many access requests. Please try again later." },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function serializeState(
  state: any,
  currentUserId: string | null,
  { includeStateBody = true }: { includeStateBody?: boolean } = {},
): SavedStateRecord | null {
  if (!state) return null;
  const parsedState = normalizeSavedState(
    state.stateJson ? JSON.parse(state.stateJson) : {},
  );
  const role = effectiveRole(state, currentUserId) as SavedStateRole;
  const counts = countSelectionsIn(parsedState);
  const out: SavedStateRecord = {
    id: state.id,
    name: state.name,
    owner: state.owner
      ? { id: state.owner.id, email: state.owner.email, name: state.owner.name }
      : { id: state.ownerId },
    role,
    isOwner: role === "owner",
    counts,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    visibility:
      parsedState.visibility === "link" || parsedState.visibility === "public"
        ? parsedState.visibility
        : "private",
  };
  if (includeStateBody) {
    out.state = parsedState as SavedStateBlob;
  }
  return out;
}

function serializeShare(share: any): SavedStateShare {
  return {
    id: share.id,
    userId: share.userId,
    role: share.role,
    user: share.user
      ? { id: share.user.id, email: share.user.email, name: share.user.name }
      : null,
    createdAt: share.createdAt,
    updatedAt: share.updatedAt,
  };
}

function serializeRequest(request: any): SavedStateAccessRequest {
  return {
    id: request.id,
    userId: request.userId,
    requestedRole: request.requestedRole,
    status: request.status,
    message: request.message,
    createdAt: request.createdAt,
    user: request.user
      ? {
          id: request.user.id,
          email: request.user.email,
          name: request.user.name,
        }
      : null,
  };
}

// ---- GET /api/saved-states ----
router.get("/", async (req: MaybeAuthedRequest, res) => {
  try {
    const userId = req.user?.id || null;
    const where = userId
      ? {
          OR: [
            { ownerId: userId },
            { shares: { some: { userId } } },
            { stateJson: { contains: '"visibility":"public"' } },
          ],
        }
      : { stateJson: { contains: '"visibility":"public"' } };
    const states = await prisma.savedState.findMany({
      where,
      include: { owner: true, shares: true },
      orderBy: { updatedAt: "desc" },
    });
    res.json(
      states.map((state) =>
        serializeState(state, userId, { includeStateBody: false }),
      ),
    );
  } catch (err) {
    console.error("[saved-states] list error", err);
    res.status(500).json({ error: "Could not load saved states." });
  }
});

// ---- POST /api/saved-states ----
router.post("/", requireAuth, writeLimiter, async (req: AuthedRequest, res) => {
  const { name, state } = req.body || {};
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "A name is required." });
  }
  if (name.length > 120) {
    return res.status(400).json({ error: "Name is too long." });
  }
  try {
    const normalized = normalizeSavedState(state);
    const created = await prisma.savedState.create({
      data: {
        name: name.trim(),
        ownerId: req.user.id,
        stateJson: JSON.stringify(normalized),
      },
      include: { owner: true, shares: true },
    });
    res.status(201).json(serializeState(created, req.user.id));
  } catch (err) {
    console.error("[saved-states] create error", err);
    res.status(500).json({ error: "Could not create saved state." });
  }
});

async function loadStateWithAuth(
  req: MaybeAuthedRequest,
  res,
  { minRole = "view" }: { minRole?: "view" | "edit" | "admin" | "owner" } = {},
) {
  const id = paramValue(req.params.id);
  const state = await prisma.savedState.findUnique({
    where: { id },
    include: { owner: true, shares: true },
  });
  if (!state) {
    res.status(404).json({ error: "Saved state not found." });
    return null;
  }
  const role = effectiveRole(state, req.user?.id || null);
  const check =
    minRole === "view"
      ? canView(role)
      : minRole === "edit"
        ? canEdit(role)
        : minRole === "admin"
          ? canManageShares(role)
          : minRole === "owner"
            ? canTransferOwner(role)
            : false;
  if (!check) {
    res.status(403).json({
      error: "You do not have access to this saved state.",
      code: "FORBIDDEN",
    });
    return null;
  }
  return { state, role };
}

// ---- GET /api/saved-states/:id ----
router.get("/:id", async (req: MaybeAuthedRequest, res) => {
  try {
    const result = await loadStateWithAuth(req, res);
    if (!result) return;
    res.json(serializeState(result.state, req.user?.id || null));
  } catch (err) {
    console.error("[saved-states] get error", err);
    res.status(500).json({ error: "Could not load saved state." });
  }
});

// ---- GET /api/saved-states/:id/meta ----
// Does NOT require access; used by the "request access" screen.
router.get("/:id/meta", async (req: MaybeAuthedRequest, res) => {
  try {
    const state = await prisma.savedState.findUnique({
      where: { id: paramValue(req.params.id) },
      include: { owner: true, shares: true },
    });
    if (!state)
      return res.status(404).json({ error: "Saved state not found." });
    const role = effectiveRole(state, req.user?.id || null);
    const pending = req.user?.id
      ? await prisma.accessRequest.findFirst({
          where: { stateId: state.id, userId: req.user.id, status: "pending" },
        })
      : null;
    const parsedState = normalizeSavedState(
      JSON.parse(state.stateJson || "{}"),
    );
    const response: SavedStateMeta = {
      id: state.id,
      name: state.name,
      owner: state.owner
        ? {
            id: state.owner.id,
            email: state.owner.email,
            name: state.owner.name,
          }
        : undefined,
      role,
      hasAccess: canView(role),
      visibility:
        parsedState.visibility === "link" || parsedState.visibility === "public"
          ? parsedState.visibility
          : "private",
      pendingRequest: pending
        ? {
            id: pending.id,
            requestedRole: pending.requestedRole as Exclude<
              SavedStateRole,
              "owner"
            >,
            createdAt: pending.createdAt,
          }
        : null,
    };
    res.json(response);
  } catch (err) {
    console.error("[saved-states] meta error", err);
    res.status(500).json({ error: "Could not load state metadata." });
  }
});

// ---- PUT /api/saved-states/:id ----
// Body: { name?, state?: full v2 blob, slice?: { catalogId, year, selected, passed, excluded, hiddenLevels } }
// If `slice` is given, the server merges it into the stored state.
// If `state` is given (full blob), it replaces the state.
router.put(
  "/:id",
  requireAuth,
  writeLimiter,
  async (req: AuthedRequest, res) => {
    try {
      const result = await loadStateWithAuth(req, res, { minRole: "edit" });
      if (!result) return;

      const { state: fullState, slice, name } = req.body || {};
      const updateData: { name?: string; stateJson?: string } = {};
      if (typeof name === "string") {
        const trimmed = name.trim();
        if (!trimmed)
          return res.status(400).json({ error: "Name cannot be empty." });
        if (trimmed.length > 120)
          return res.status(400).json({ error: "Name is too long." });
        updateData.name = trimmed;
      }

      if (slice && typeof slice === "object") {
        const existing = JSON.parse(result.state.stateJson || "{}");
        const merged = mergeSlice(existing, {
          catalogId: slice.catalogId,
          year: slice.year,
          slice: {
            selected: slice.selected,
            passed: slice.passed,
            excluded: slice.excluded,
            hiddenLevels: slice.hiddenLevels,
          },
        });
        updateData.stateJson = JSON.stringify(merged);
      } else if (fullState && typeof fullState === "object") {
        updateData.stateJson = JSON.stringify(normalizeSavedState(fullState));
      } else if (!("name" in updateData)) {
        return res.status(400).json({ error: "Nothing to update." });
      }

      const updated = await prisma.savedState.update({
        where: { id: result.state.id },
        data: updateData,
        include: { owner: true, shares: true },
      });
      res.json(serializeState(updated, req.user.id));
    } catch (err) {
      console.error("[saved-states] update error", err);
      res.status(500).json({ error: "Could not update saved state." });
    }
  },
);

// ---- DELETE /api/saved-states/:id ----
router.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const state = await prisma.savedState.findUnique({
      where: { id: paramValue(req.params.id) },
      include: { shares: true },
    });
    if (!state)
      return res.status(404).json({ error: "Saved state not found." });
    const role = effectiveRole(state, req.user.id);
    if (!canDelete(role)) {
      return res.status(403).json({
        error: "Only the owner or an admin can delete this saved state.",
      });
    }
    await prisma.savedState.delete({ where: { id: state.id } });
    res.status(204).end();
  } catch (err) {
    console.error("[saved-states] delete error", err);
    res.status(500).json({ error: "Could not delete saved state." });
  }
});

// ---- GET /api/saved-states/:id/shares ----
router.get("/:id/shares", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const result = await loadStateWithAuth(req, res, { minRole: "admin" });
    if (!result) return;
    const shares = await prisma.savedStateShare.findMany({
      where: { stateId: result.state.id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
    const requests = await prisma.accessRequest.findMany({
      where: { stateId: result.state.id, status: "pending" },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
    const parsedState = normalizeSavedState(
      JSON.parse(result.state.stateJson || "{}"),
    );
    res.json({
      owner: {
        id: result.state.owner.id,
        email: result.state.owner.email,
        name: result.state.owner.name,
      },
      visibility:
        parsedState.visibility === "link" || parsedState.visibility === "public"
          ? parsedState.visibility
          : "private",
      shares: shares.map(serializeShare),
      requests: requests.map(serializeRequest),
    });
  } catch (err) {
    console.error("[saved-states] list shares error", err);
    res.status(500).json({ error: "Could not load shares." });
  }
});

// ---- POST /api/saved-states/:id/shares ----
// Body: { email, role }
router.post(
  "/:id/shares",
  requireAuth,
  writeLimiter,
  async (req: AuthedRequest, res) => {
    try {
      const result = await loadStateWithAuth(req, res, { minRole: "admin" });
      if (!result) return;
      const { email, role, visibility } = req.body || {};

      if (["private", "link", "public"].includes(visibility)) {
        const parsed = normalizeSavedState(
          JSON.parse(result.state.stateJson || "{}"),
        );
        parsed.visibility = visibility;
        await prisma.savedState.update({
          where: { id: result.state.id },
          data: { stateJson: JSON.stringify(parsed) },
        });
        return res.status(200).json({ ok: true, visibility });
      }

      const normalizedEmail = String(email || "")
        .trim()
        .toLowerCase();
      if (!EMAIL_RE.test(normalizedEmail)) {
        return res.status(400).json({ error: "Please provide a valid email." });
      }
      if (!isValidRole(role)) {
        return res
          .status(400)
          .json({ error: `Role must be one of: ${ROLES.join(", ")}.` });
      }
      const targetUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (!targetUser) {
        return res.status(404).json({
          error: "No user found with that email. They need to sign up first.",
        });
      }
      if (targetUser.id === result.state.ownerId) {
        return res
          .status(400)
          .json({ error: "The owner already has full access." });
      }
      const share = await prisma.savedStateShare.upsert({
        where: {
          stateId_userId: { stateId: result.state.id, userId: targetUser.id },
        },
        update: { role },
        create: { stateId: result.state.id, userId: targetUser.id, role },
        include: { user: true },
      });
      // Clear any pending request from this user.
      await prisma.accessRequest.updateMany({
        where: {
          stateId: result.state.id,
          userId: targetUser.id,
          status: "pending",
        },
        data: { status: "approved", resolvedAt: new Date() },
      });
      res.status(201).json(serializeShare(share));
    } catch (err) {
      console.error("[saved-states] add share error", err);
      res.status(500).json({ error: "Could not add share." });
    }
  },
);

// ---- DELETE /api/saved-states/:id/shares/:shareId ----
router.delete(
  "/:id/shares/:shareId",
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const result = await loadStateWithAuth(req, res, { minRole: "admin" });
      if (!result) return;
      const share = await prisma.savedStateShare.findUnique({
        where: { id: paramValue(req.params.shareId) },
      });
      if (!share || share.stateId !== result.state.id) {
        return res.status(404).json({ error: "Share not found." });
      }
      await prisma.savedStateShare.delete({ where: { id: share.id } });
      res.status(204).end();
    } catch (err) {
      console.error("[saved-states] delete share error", err);
      res.status(500).json({ error: "Could not revoke share." });
    }
  },
);

// ---- POST /api/saved-states/:id/transfer ----
// Body: { newOwnerId }  — must be an existing share holder.
router.post(
  "/:id/transfer",
  requireAuth,
  writeLimiter,
  async (req: AuthedRequest, res) => {
    try {
      const result = await loadStateWithAuth(req, res, { minRole: "owner" });
      if (!result) return;
      const { newOwnerId } = req.body || {};
      if (!newOwnerId || typeof newOwnerId !== "string") {
        return res.status(400).json({ error: "newOwnerId is required." });
      }
      if (newOwnerId === req.user.id) {
        return res.status(400).json({ error: "You are already the owner." });
      }
      const targetShare = await prisma.savedStateShare.findUnique({
        where: {
          stateId_userId: { stateId: result.state.id, userId: newOwnerId },
        },
      });
      if (!targetShare) {
        return res.status(400).json({
          error: "The new owner must first be granted access to this state.",
        });
      }
      const previousOwnerId = result.state.ownerId;
      await prisma.$transaction([
        prisma.savedState.update({
          where: { id: result.state.id },
          data: { ownerId: newOwnerId },
        }),
        prisma.savedStateShare.delete({ where: { id: targetShare.id } }),
        prisma.savedStateShare.upsert({
          where: {
            stateId_userId: {
              stateId: result.state.id,
              userId: previousOwnerId,
            },
          },
          update: { role: "admin" },
          create: {
            stateId: result.state.id,
            userId: previousOwnerId,
            role: "admin",
          },
        }),
      ]);
      res.json({ ok: true });
    } catch (err) {
      console.error("[saved-states] transfer error", err);
      res.status(500).json({ error: "Could not transfer ownership." });
    }
  },
);

// ---- POST /api/saved-states/:id/request-access ----
router.post(
  "/:id/request-access",
  requireAuth,
  requestLimiter,
  async (req: AuthedRequest, res) => {
    try {
      const { requestedRole = "view", message } = req.body || {};
      if (!isValidRole(requestedRole)) {
        return res
          .status(400)
          .json({ error: `Role must be one of: ${ROLES.join(", ")}.` });
      }
      const state = await prisma.savedState.findUnique({
        where: { id: paramValue(req.params.id) },
        include: { owner: true, shares: true },
      });
      if (!state)
        return res.status(404).json({ error: "Saved state not found." });

      const role = effectiveRole(state, req.user.id);
      if (canView(role)) {
        return res
          .status(400)
          .json({ error: "You already have access to this state." });
      }

      // Deduplicate: if there's already a pending request, return it.
      const existing = await prisma.accessRequest.findFirst({
        where: { stateId: state.id, userId: req.user.id, status: "pending" },
      });
      let request = existing;
      if (!request) {
        request = await prisma.accessRequest.create({
          data: {
            stateId: state.id,
            userId: req.user.id,
            requestedRole,
            message: typeof message === "string" ? message.slice(0, 500) : null,
          },
        });
      }

      // Notify the owner (best-effort).
      try {
        await sendAccessRequestEmail({
          to: state.owner?.email,
          ownerName: state.owner?.name,
          requesterEmail: req.user.email,
          requesterName: req.user.name,
          stateName: state.name,
          requestedRole,
          message: request.message,
          manageUrl: `${APP_URL}/${encodeURIComponent(String(state.id))}`,
        });
      } catch (err) {
        console.error("[saved-states] email send failed", err);
      }

      res.status(201).json({
        id: request.id,
        requestedRole: request.requestedRole,
        status: request.status,
      });
    } catch (err) {
      console.error("[saved-states] request-access error", err);
      res.status(500).json({ error: "Could not submit request." });
    }
  },
);

// ---- POST /api/saved-states/:id/requests/:requestId ----
// Body: { action: 'approve'|'deny', role?: 'view'|'edit'|'admin' }
router.post(
  "/:id/requests/:requestId",
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const result = await loadStateWithAuth(req, res, { minRole: "admin" });
      if (!result) return;
      const { action, role } = req.body || {};
      if (action !== "approve" && action !== "deny") {
        return res
          .status(400)
          .json({ error: "action must be approve or deny." });
      }
      const request = await prisma.accessRequest.findUnique({
        where: { id: paramValue(req.params.requestId) },
      });
      if (
        !request ||
        request.stateId !== result.state.id ||
        request.status !== "pending"
      ) {
        return res.status(404).json({ error: "Pending request not found." });
      }

      if (action === "deny") {
        await prisma.accessRequest.update({
          where: { id: request.id },
          data: { status: "denied", resolvedAt: new Date() },
        });
        return res.json({ ok: true, status: "denied" });
      }

      const grantedRole = isValidRole(role) ? role : request.requestedRole;
      await prisma.$transaction([
        prisma.savedStateShare.upsert({
          where: {
            stateId_userId: {
              stateId: result.state.id,
              userId: request.userId,
            },
          },
          update: { role: grantedRole },
          create: {
            stateId: result.state.id,
            userId: request.userId,
            role: grantedRole,
          },
        }),
        prisma.accessRequest.update({
          where: { id: request.id },
          data: { status: "approved", resolvedAt: new Date() },
        }),
      ]);
      res.json({ ok: true, status: "approved", role: grantedRole });
    } catch (err) {
      console.error("[saved-states] resolve request error", err);
      res.status(500).json({ error: "Could not resolve request." });
    }
  },
);

export default router;
