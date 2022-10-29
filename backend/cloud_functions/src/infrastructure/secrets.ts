import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

/**
 * Accessor for secrets stored in Google Cloud Secret Manager.
 */
export class SecretsAccessor {
  constructor(private readonly secretManager: SecretManagerServiceClient) {}

  /**
   * Accesses a secret from Google Cloud Secret Manager.
   * @param secret the name of the secret in Google Cloud Secret Manager.
   * @returns the payload of the secret.
   */
  async access(secret: string): Promise<string> {
    const [accessResponse] = await this.secretManager.accessSecretVersion({
      name: `projects/github-tracker-b5c54/secrets/${secret}/versions/latest`,
    });

    const responsePayload = accessResponse.payload!.data!.toString();
    return responsePayload;
  }
}
