"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonClass } from "@nakamura196/react-ui";
import {
  Loader2,
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Calendar,
  AlertTriangle,
} from "lucide-react";

interface ApiKeyInfo {
  id: string;
  name: string;
  createdAt: string;
  expiresAt?: string;
}

interface NewKeyResponse {
  id: string;
  key: string;
  name: string;
}

export default function ApiKeysPage() {
  const t = useTranslations("ApiKeys");
  const [user, setUser] = useState<User | null>(null);
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpires, setNewKeyExpires] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<NewKeyResponse | null>(
    null
  );
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);

  const getIdToken = async (): Promise<string | null> => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    return currentUser.getIdToken();
  };

  const loadKeys = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getIdToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch("/api/api-keys", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("API response:", response.status, errorData);
        throw new Error(errorData.error || "Failed to load API keys");
      }

      const data = await response.json();
      setKeys(data.keys || []);
    } catch (err) {
      console.error("Error loading API keys:", err);
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadKeys();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    try {
      setCreating(true);
      const token = await getIdToken();
      if (!token) return;

      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newKeyName.trim(),
          expiresInDays: newKeyExpires ? parseInt(newKeyExpires) : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("API response:", response.status, errorData);
        throw new Error(errorData.error || "Failed to create API key");
      }

      const data = await response.json();
      setNewlyCreatedKey(data);
      setNewKeyName("");
      setNewKeyExpires("");
      await loadKeys();
    } catch (err) {
      console.error("Error creating API key:", err);
      setError(t("createError"));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm(t("confirmDelete"))) return;

    try {
      setDeletingKeyId(keyId);
      const token = await getIdToken();
      if (!token) return;

      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete API key");
      }

      await loadKeys();
    } catch (err) {
      console.error("Error deleting API key:", err);
      setError(t("deleteError"));
    } finally {
      setDeletingKeyId(null);
    }
  };

  const copyToClipboard = async (text: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeyId(keyId);
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const isExpired = (expiresAt?: string): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() < Date.now();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[var(--ds-primary)]" />
          <p className="text-[var(--ds-fg-muted)]">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertDescription>{t("loginRequired")}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-[var(--ds-fg)]">
          {t("title")}
        </h1>
        <p className="text-[var(--ds-fg-muted)]">{t("description")}</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Newly Created Key Display */}
      {newlyCreatedKey && (
        <Alert className="mb-6 border-green-500 bg-green-50 dark:bg-green-900/20">
          <AlertTriangle className="h-4 w-4 text-green-600" />
          <AlertDescription className="ml-2">
            <p className="font-semibold text-green-800 dark:text-green-200 mb-2">
              {t("keyCreated")}
            </p>
            <div className="flex items-center gap-2 bg-[var(--ds-bg)] p-2 rounded border border-[var(--ds-border)]">
              <code className="flex-1 text-sm break-all">
                {newlyCreatedKey.key}
              </code>
              <button
                onClick={() =>
                  copyToClipboard(newlyCreatedKey.key, "new-key")
                }
                className="p-1 hover:bg-[var(--ds-surface-2)] rounded"
              >
                {copiedKeyId === "new-key" ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300 mt-2">
              {t("saveKeyWarning")}
            </p>
            <button
              onClick={() => setNewlyCreatedKey(null)}
              className="mt-2 text-sm text-green-600 hover:text-green-800 dark:text-green-400"
            >
              {t("dismiss")}
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Create Button */}
      <div className="mb-6">
        <button
          onClick={() => setShowCreateModal(true)}
          className={buttonClass("primary", "sm", "gap-2")}
        >
          <Plus className="h-4 w-4" />
          {t("createKey")}
        </button>
      </div>

      {/* Keys List */}
      {keys.length === 0 ? (
        <div className="text-center py-12">
          <Key className="h-12 w-12 mx-auto mb-4 text-[var(--ds-fg-muted)]" />
          <p className="text-[var(--ds-fg-muted)]">{t("noKeys")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {keys.map((key) => (
            <Card
              key={key.id}
              className={isExpired(key.expiresAt) ? "opacity-60" : ""}
            >
              <CardContent className="px-6 pt-5 pb-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Key className="h-4 w-4 text-[var(--ds-fg-muted)]" />
                      <span className="font-medium text-[var(--ds-fg)]">
                        {key.name}
                      </span>
                      {isExpired(key.expiresAt) && (
                        <span className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-2 py-0.5 rounded">
                          {t("expired")}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-[var(--ds-fg-muted)]">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {t("created")}: {formatDate(key.createdAt)}
                        </span>
                      </div>
                      {key.expiresAt && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {t("expires")}: {formatDate(key.expiresAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteKey(key.id)}
                    disabled={deletingKeyId === key.id}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30
                      rounded-md transition-colors disabled:opacity-50"
                  >
                    {deletingKeyId === key.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Usage Guide */}
      <div className="mt-8 space-y-4">
        <h3 className="text-xl font-bold text-[var(--ds-fg)]">
          {t("usageTitle")}
        </h3>

        {/* Endpoint */}
        <div className="p-4 bg-[var(--ds-surface-2)] rounded-lg space-y-1">
          <h4 className="font-semibold text-[var(--ds-fg)]">
            {t("usageEndpoint")}
          </h4>
          <code className="text-sm text-[var(--ds-fg)] block">
            GET {typeof window !== "undefined" ? window.location.origin : ""}/api/annotations
          </code>
        </div>

        {/* Auth */}
        <div className="p-4 bg-[var(--ds-surface-2)] rounded-lg space-y-1">
          <h4 className="font-semibold text-[var(--ds-fg)]">
            {t("usageAuth")}
          </h4>
          <p className="text-sm text-[var(--ds-fg)]">
            {t("usageAuthDesc")}
          </p>
          <code className="text-sm text-[var(--ds-fg)] block mt-1">
            X-API-Key: YOUR_API_KEY
          </code>
        </div>

        {/* Params */}
        <div className="p-4 bg-[var(--ds-surface-2)] rounded-lg space-y-1">
          <h4 className="font-semibold text-[var(--ds-fg)]">
            {t("usageParams")}
          </h4>
          <p className="text-sm text-[var(--ds-fg)]">
            {t("usageParamManifestIds")}
          </p>
        </div>

        {/* curl example */}
        <div className="p-4 bg-[var(--ds-surface-2)] rounded-lg space-y-2">
          <h4 className="font-semibold text-[var(--ds-fg)]">
            {t("usageExample")} (curl)
          </h4>
          <pre className="text-sm text-[var(--ds-fg)] whitespace-pre-wrap break-all overflow-x-auto">
{`curl -H "X-API-Key: YOUR_API_KEY" \\
  "${typeof window !== "undefined" ? window.location.origin : ""}/api/annotations?manifestIds=https://example.com/manifest.json"`}
          </pre>
        </div>

        {/* Python example */}
        <div className="p-4 bg-[var(--ds-surface-2)] rounded-lg space-y-2">
          <h4 className="font-semibold text-[var(--ds-fg)]">
            {t("usagePython")}
          </h4>
          <pre className="text-sm text-[var(--ds-fg)] whitespace-pre-wrap break-all overflow-x-auto">
{`import requests

response = requests.get(
    "${typeof window !== "undefined" ? window.location.origin : ""}/api/annotations",
    headers={"X-API-Key": "YOUR_API_KEY"},
    params={"manifestIds": "https://example.com/manifest.json"}
)

data = response.json()
for manifest in data["annotations"]:
    print(f"Manifest: {manifest['manifestId']}")
    for item in manifest["items"]:
        body = item.get("body", {})
        print(f"  - {body.get('value', '')}")`}
          </pre>
        </div>

        {/* Response example */}
        <div className="p-4 bg-[var(--ds-surface-2)] rounded-lg space-y-2">
          <h4 className="font-semibold text-[var(--ds-fg)]">
            {t("usageResponseTitle")}
          </h4>
          <pre className="text-sm text-[var(--ds-fg)] whitespace-pre-wrap overflow-x-auto">
{`{
  "userId": "abc123",
  "annotations": [
    {
      "manifestId": "https://example.com/manifest.json",
      "items": [
        {
          "id": "anno1",
          "body": { "type": "TextualBody", "value": "..." },
          "target": { "selector": [...], "source": {...} },
          "created": "2025-01-15T10:00:00.000Z",
          "modified": "2025-01-15T10:05:00.000Z"
        }
      ]
    }
  ]
}`}
          </pre>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--ds-bg)] border border-[var(--ds-border)] p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-[var(--ds-fg)]">
              {t("createKeyTitle")}
            </h2>

            <form onSubmit={handleCreateKey} className="space-y-4">
              <div>
                <label className="block mb-2 text-[var(--ds-fg)]">
                  {t("keyName")}
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder={t("keyNamePlaceholder")}
                  className="w-full p-2 border rounded-md bg-[var(--ds-bg)]
                    border-[var(--ds-border)] text-[var(--ds-fg)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--ds-ring)]"
                  required
                />
              </div>

              <div>
                <label className="block mb-2 text-[var(--ds-fg)]">
                  {t("expiresIn")}
                </label>
                <select
                  value={newKeyExpires}
                  onChange={(e) => setNewKeyExpires(e.target.value)}
                  className="w-full p-2 border rounded-md bg-[var(--ds-bg)]
                    border-[var(--ds-border)] text-[var(--ds-fg)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--ds-ring)]"
                >
                  <option value="">{t("noExpiry")}</option>
                  <option value="7">{t("days", { count: 7 })}</option>
                  <option value="30">{t("days", { count: 30 })}</option>
                  <option value="90">{t("days", { count: 90 })}</option>
                  <option value="365">{t("days", { count: 365 })}</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewKeyName("");
                    setNewKeyExpires("");
                  }}
                  className={buttonClass("secondary", "sm")}
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={creating || !newKeyName.trim()}
                  className={buttonClass("primary", "sm", "gap-2")}
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
