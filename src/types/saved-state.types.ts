export type SavedStateRole = "view" | "edit" | "admin" | "owner";

export type SavedStateSlice = {
  selected: string[];
  passed: string[];
  excluded: string[];
  hiddenLevels: string[];
};

export type SavedStateBlob = {
  version: 2;
  catalogs: Record<string, Record<string, SavedStateSlice>>;
};

export type SavedStateCounts = {
  selected: number;
  excluded: number;
  catalogs: number;
};

export type SavedStateOwner = {
  id: string;
  email?: string;
  name?: string | null;
};

export type SavedStateRecord = {
  id: string;
  name: string;
  owner?: SavedStateOwner;
  role: SavedStateRole;
  isOwner?: boolean;
  counts?: SavedStateCounts;
  state?: SavedStateBlob;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type SavedStateShare = {
  id: string;
  role: Exclude<SavedStateRole, "owner">;
  userId?: string;
  user?: SavedStateOwner | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type SavedStateAccessRequest = {
  id: string;
  requestedRole: Exclude<SavedStateRole, "owner">;
  status?: string;
  message?: string | null;
  userId?: string;
  user?: SavedStateOwner | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type SavedStateMeta = {
  id: string;
  name: string;
  owner?: SavedStateOwner;
  role?: SavedStateRole | null;
  hasAccess?: boolean;
  pendingRequest?: {
    id: string;
    requestedRole: Exclude<SavedStateRole, "owner">;
    createdAt: string | Date;
  } | null;
};

export type SavedStateSharesResponse = {
  owner?: SavedStateOwner;
  shares: SavedStateShare[];
  requests: SavedStateAccessRequest[];
};

export type ApiError = Error & {
  status?: number;
  data?: unknown;
  code?: string;
};
