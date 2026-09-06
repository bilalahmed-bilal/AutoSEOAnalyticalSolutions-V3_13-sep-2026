import { refreshConnectionIfNeeded } from "@/lib/oauth/lifecycle";
export async function refreshGoogleYouTubeConnection(connectionId: string, encryptedCredentials: string) {
  return refreshConnectionIfNeeded({ id: connectionId, provider: "google-youtube", encrypted_credentials: encryptedCredentials });
}
