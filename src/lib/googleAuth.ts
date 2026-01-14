// Type definitions for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfiguration) => void;
          renderButton: (parent: HTMLElement, options: GoogleButtonConfiguration) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: CredentialResponse) => void;
  auto_select?: boolean;
  use_fedcm_for_prompt?: boolean;
}

interface GoogleButtonConfiguration {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number;
}

interface CredentialResponse {
  credential: string;
  select_by?: string;
}

/**
 * Initialize and render Google Sign-In button
 * @param containerId - The ID of the HTML element to render the button in
 * @param onSuccess - Callback function when sign-in succeeds, receives the ID token
 * @param onError - Callback function when sign-in fails
 */
export function initializeGoogleButton(
  containerId: string,
  onSuccess: (idToken: string) => void,
  onError: (error: Error) => void
): void {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId) {
    onError(new Error('Google Client ID is not configured'));
    return;
  }

  // Wait for Google Identity Services to load
  const initializeWhenReady = () => {
    if (window.google?.accounts?.id) {
      try {
        // Initialize Google Identity Services
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: CredentialResponse) => {
            onSuccess(response.credential);
          },
          auto_select: false,
          use_fedcm_for_prompt: true, // Enable FedCM for personalized button
        });

        // Render the button
        const buttonContainer = document.getElementById(containerId);
        if (buttonContainer) {
          window.google.accounts.id.renderButton(buttonContainer, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: buttonContainer.offsetWidth || 300,
          });
        } else {
          onError(new Error(`Container with id "${containerId}" not found`));
        }
      } catch (err) {
        onError(err instanceof Error ? err : new Error('Failed to initialize Google Sign-In'));
      }
    } else {
      // Retry after a short delay if Google Identity Services isn't ready yet
      setTimeout(initializeWhenReady, 100);
    }
  };

  initializeWhenReady();
}
