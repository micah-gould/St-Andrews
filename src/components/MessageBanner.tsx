import React from "react";
import type { AuthMessage } from "../types/auth.types";

export function MessageBanner({ message }: { message: AuthMessage | null }) {
  if (!message) {
    return null;
  }

  return <div className={`message ${message.type}`}>{message.text}</div>;
}
