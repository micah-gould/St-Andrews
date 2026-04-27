import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { savedStatesApi as defaultSavedStatesApi } from "../savedStatesApi";
import type {
  SavedStateRecord,
  SavedStateSharesResponse,
} from "../types/saved-state.types";

const ROLE_OPTIONS = ["view", "edit", "admin"];

type ShareDialogProps = {
  savedStatesApi: typeof defaultSavedStatesApi;
  state: SavedStateRecord;
  onChange?: () => Promise<void> | void;
  onClose: () => void;
};

function ShareDialog({
  savedStatesApi,
  state,
  onChange,
  onClose,
}: ShareDialogProps) {
  const isOwner = state.role === "owner" || state.isOwner;
  const isAdmin = state.role === "admin";
  const [data, setData] = useState<SavedStateSharesResponse | null>(null);
  const [error, setError] = useState("");
  const shareLink = window.location.href;

  const refresh = async () => {
    setError("");
    try {
      setData(await savedStatesApi.listShares(state.id));
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    refresh();
  }, [state.id]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const shares = data?.shares || [];
  const requests = data?.requests || [];
  const owner = data?.owner;

  return (
    <div
      id="share-dialog-backdrop"
      className="share-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Share plan"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="share-dialog">
        <header className="share-dialog__header">
          <h2>Share &quot;{state.name}&quot;</h2>
          <button
            type="button"
            className="share-dialog__close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="share-dialog__body">
          {!data && !error ? <p>Loading...</p> : null}
          {error ? <p className="share-error">{error}</p> : null}
          {data ? (
            <>
              <section className="share-section">
                <label className="share-label">Share link</label>
                <div className="share-link-row">
                  <input
                    type="text"
                    readOnly
                    value={shareLink}
                    className="share-link-input"
                  />
                  <button
                    type="button"
                    className="share-copy-btn"
                    onClick={async (event) => {
                      try {
                        await navigator.clipboard.writeText(shareLink);
                        const old = event.currentTarget.textContent;
                        event.currentTarget.textContent = "Copied!";
                        setTimeout(() => {
                          event.currentTarget.textContent = old;
                        }, 1200);
                      } catch {}
                    }}
                  >
                    Copy
                  </button>
                </div>
                <p className="share-hint">
                  Anyone with the link who has access will see this plan; others
                  can request access.
                </p>
              </section>

              <section className="share-section">
                <label className="share-label">Owner</label>
                <div className="share-row share-row--owner">
                  <span>{owner?.email || "—"}</span>
                  <span className="share-role-tag">owner</span>
                </div>
              </section>

              <section className="share-section">
                <label className="share-label">People with access</label>
                {shares.length === 0 ? (
                  <p className="share-hint">No one else has access yet.</p>
                ) : null}
                <ul className="share-list">
                  {shares.map((share) => (
                    <li key={share.id} className="share-row">
                      <span>{share.user?.email || "(unknown)"}</span>
                      {isOwner || (isAdmin && share.role !== "admin") ? (
                        <>
                          <select
                            className="share-role-select"
                            defaultValue={share.role}
                            onChange={async (event) => {
                              const previous = share.role;
                              const nextRole = event.target.value;
                              try {
                                await savedStatesApi.addShare(state.id, {
                                  email: share.user?.email,
                                  role: nextRole,
                                });
                                await onChange?.();
                                await refresh();
                              } catch (err) {
                                event.target.value = previous;
                                alert(err.message);
                              }
                            }}
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="share-remove-btn"
                            onClick={async () => {
                              if (!confirm("Remove this person's access?"))
                                return;
                              try {
                                await savedStatesApi.removeShare(
                                  state.id,
                                  share.id,
                                );
                                await onChange?.();
                                await refresh();
                              } catch (err) {
                                alert(err.message);
                              }
                            }}
                          >
                            Remove
                          </button>
                        </>
                      ) : (
                        <span className="share-role-tag">{share.role}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="share-section">
                <label className="share-label" htmlFor="share-add-email">
                  Invite by email
                </label>
                <form
                  className="share-add-form"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    const email = (formData.get("email") || "")
                      .toString()
                      .trim();
                    const role = (formData.get("role") || "view").toString();
                    if (!email) return;
                    try {
                      await savedStatesApi.addShare(state.id, { email, role });
                      await onChange?.();
                      await refresh();
                      event.currentTarget.reset();
                    } catch (err) {
                      alert(err.message);
                    }
                  }}
                >
                  <input
                    id="share-add-email"
                    name="email"
                    type="email"
                    required
                    placeholder="name@example.com"
                  />
                  <select name="role" defaultValue="view">
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button type="submit">Invite</button>
                </form>
                <p className="share-hint">
                  The person must already have an account.
                </p>
              </section>

              {requests.length ? (
                <section className="share-section">
                  <label className="share-label">Pending access requests</label>
                  <ul className="share-list">
                    {requests.map((request) => (
                      <li key={request.id} className="share-row">
                        <span>
                          {request.user?.email || "(unknown)"}{" "}
                          <em>wants {request.requestedRole}</em>
                          {request.message ? (
                            <div className="share-req-msg">
                              &quot;{request.message}&quot;
                            </div>
                          ) : null}
                        </span>
                        <select
                          className="share-approve-role"
                          defaultValue={request.requestedRole}
                          id={`request-role-${request.id}`}
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="share-approve-btn"
                          onClick={async () => {
                            const role =
                              (
                                document.getElementById(
                                  `request-role-${request.id}`,
                                ) as HTMLSelectElement | null
                              )?.value || request.requestedRole;
                            try {
                              await savedStatesApi.resolveRequest(
                                state.id,
                                request.id,
                                { action: "approve", role },
                              );
                              await onChange?.();
                              await refresh();
                            } catch (err) {
                              alert(err.message);
                            }
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="share-deny-btn"
                          onClick={async () => {
                            try {
                              await savedStatesApi.resolveRequest(
                                state.id,
                                request.id,
                                { action: "deny" },
                              );
                              await onChange?.();
                              await refresh();
                            } catch (err) {
                              alert(err.message);
                            }
                          }}
                        >
                          Deny
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {isOwner && shares.length ? (
                <section className="share-section share-section--danger">
                  <label className="share-label">Transfer ownership</label>
                  <p className="share-hint">
                    The new owner must already have access. You will be demoted
                    to admin.
                  </p>
                  <form
                    className="share-transfer-form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      const targetId = (
                        formData.get("targetId") || ""
                      ).toString();
                      if (!targetId) return;
                      const email =
                        shares.find((share) => share.user?.id === targetId)
                          ?.user?.email || "this user";
                      if (
                        !confirm(
                          `Transfer ownership to ${email}? You will become an admin.`,
                        )
                      )
                        return;
                      try {
                        await savedStatesApi.transfer(state.id, targetId);
                        await onChange?.();
                        onClose();
                      } catch (err) {
                        alert(err.message);
                      }
                    }}
                  >
                    <select
                      name="targetId"
                      defaultValue={shares[0]?.user?.id || ""}
                    >
                      {shares.map((share) => (
                        <option
                          key={share.user?.id || share.id}
                          value={share.user?.id || ""}
                        >
                          {share.user?.email || ""}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="share-transfer-btn">
                      Transfer ownership
                    </button>
                  </form>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export async function openShareDialog({
  savedStatesApi,
  state,
  currentUser,
  onChange,
}: {
  savedStatesApi: typeof defaultSavedStatesApi;
  state: SavedStateRecord;
  currentUser?: unknown;
  onChange?: () => Promise<void> | void;
}) {
  if (!state) return;

  currentUser;
  document.getElementById("share-dialog-root")?.remove();

  const container = document.createElement("div");
  container.id = "share-dialog-root";
  document.body.append(container);
  const root = createRoot(container);

  const close = () => {
    root.unmount();
    container.remove();
  };

  root.render(
    <ShareDialog
      savedStatesApi={savedStatesApi}
      state={state}
      onChange={onChange}
      onClose={close}
    />,
  );
}
