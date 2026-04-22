export async function listSettings() {
  const response = await fetch('/api/settings');
  if (!response.ok) throw new Error(`Failed to load saved settings (${response.status})`);
  return response.json();
}

export async function saveSettings(payload) {
  const response = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to save settings (${response.status})`);
  }

  return response.json();
}

export async function deleteSettings(id) {
  const response = await fetch(`/api/settings/${id}`, { method: 'DELETE' });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to delete settings (${response.status})`);
  }
}
