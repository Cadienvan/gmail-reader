import React from 'react';
import { ExternalLink, AlertTriangle, CheckCircle, Copy, ArrowRight } from 'lucide-react';
import { Button, IconButton, Callout } from './ui';

interface OAuthSetupGuideProps {
  onSwitchToEnvironment?: () => void;
}

export const OAuthSetupGuide: React.FC<OAuthSetupGuideProps> = ({ onSwitchToEnvironment }) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Show a brief success message (you could implement a toast here)
      const button = document.activeElement as HTMLButtonElement;
      if (button) {
        const originalText = button.innerHTML;
        button.innerHTML = 'Copied!';
        setTimeout(() => {
          button.innerHTML = originalText;
        }, 1000);
      }
    });
  };

  const currentOrigin = window.location.origin;
  const redirectUri = `${currentOrigin}/auth-callback.html`;

  return (
    <div className="space-y-6">
      <Callout variant="warning" icon={<AlertTriangle className="w-5 h-5" />}>
        <h3 className="font-semibold mb-2">Security Notice</h3>
        <p className="text-sm">
          This OAuth implementation is designed for PERSONAL/DEVELOPMENT use only.
          OAuth tokens are handled client-side and client secrets are exposed to the browser.
        </p>
      </Callout>

      <Callout variant="info" icon={<CheckCircle className="w-5 h-5" />}>
        <h3 className="font-semibold mb-2">Demo Mode Available</h3>
        <p className="text-sm">
          The application works in demo mode without OAuth setup. For real Gmail integration, follow the steps below.
          You can complete this entire setup process without leaving this application!
        </p>
      </Callout>

      <div className="space-y-8">
        {/* Step 1: Create Google Cloud Project */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
            Create Google Cloud Project
          </h3>
          <div className="space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>
                Go to{' '}
                <a
                  href="https://console.cloud.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline inline-flex items-center gap-1"
                >
                  Google Cloud Console
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Create a new project or select an existing one</li>
              <li>Enable the Gmail API in "APIs &amp; Services" → "Library"</li>
            </ol>
          </div>
        </div>

        {/* Step 2: Configure OAuth Consent Screen */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
            Configure OAuth Consent Screen
          </h3>
          <div className="space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>Go to "APIs &amp; Services" → "OAuth consent screen"</li>
              <li>Select "External" user type</li>
              <li>Fill in required information (app name, support email)</li>
              <li>Add these scopes:</li>
            </ol>
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 space-y-1">
              <div className="flex items-center justify-between">
                <code className="text-xs text-gray-900 dark:text-gray-100">https://www.googleapis.com/auth/gmail.readonly</code>
                <IconButton
                  onClick={() => copyToClipboard('https://www.googleapis.com/auth/gmail.readonly')}
                  label="Copy to clipboard"
                  size="sm"
                >
                  <Copy className="w-4 h-4" />
                </IconButton>
              </div>
              <div className="flex items-center justify-between">
                <code className="text-xs text-gray-900 dark:text-gray-100">https://www.googleapis.com/auth/gmail.modify</code>
                <IconButton
                  onClick={() => copyToClipboard('https://www.googleapis.com/auth/gmail.modify')}
                  label="Copy to clipboard"
                  size="sm"
                >
                  <Copy className="w-4 h-4" />
                </IconButton>
              </div>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">5. Add your email as a test user</p>
          </div>
        </div>

        {/* Step 3: Create OAuth Client ID */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
            Create OAuth Client ID
          </h3>
          <div className="space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>Navigate to "APIs &amp; Services" → "Credentials"</li>
              <li>Click "Create Credentials" → "OAuth client ID"</li>
              <li>Choose "Web application"</li>
              <li>Add authorized JavaScript origins:</li>
            </ol>
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
              <div className="flex items-center justify-between">
                <code className="text-xs text-gray-900 dark:text-gray-100">{currentOrigin}</code>
                <IconButton
                  onClick={() => copyToClipboard(currentOrigin)}
                  label="Copy to clipboard"
                  size="sm"
                >
                  <Copy className="w-4 h-4" />
                </IconButton>
              </div>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">5. Add authorized redirect URIs:</p>
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
              <div className="flex items-center justify-between">
                <code className="text-xs text-gray-900 dark:text-gray-100">{redirectUri}</code>
                <IconButton
                  onClick={() => copyToClipboard(redirectUri)}
                  label="Copy to clipboard"
                  size="sm"
                >
                  <Copy className="w-4 h-4" />
                </IconButton>
              </div>
            </div>
          </div>
        </div>

        {/* Completion Checklist */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <span className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">✓</span>
            Setup Completion Checklist
          </h3>
          <div className="space-y-2">
            <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600" />
              <span>Google Cloud project created and Gmail API enabled</span>
            </label>
            <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600" />
              <span>OAuth consent screen configured with required scopes</span>
            </label>
            <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600" />
              <span>OAuth client ID created with correct authorized origins and redirect URIs</span>
            </label>
            <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600" />
              <span>Client ID and Client Secret copied to the Environment tab</span>
            </label>
            <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600" />
              <span>Configuration saved and page refreshed</span>
            </label>
            <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600" />
              <span>Successfully connected to Gmail (green "Connect Gmail" button)</span>
            </label>
          </div>
        </div>

        {/* Step 4: Configure Application */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</span>
            Configure Application
          </h3>
          <div className="space-y-4">
            <Callout variant="success">
              <h4 className="font-semibold mb-2">Secure Method (Recommended)</h4>
              <p className="text-sm mb-2">
                Use this configuration panel to enter your OAuth credentials:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Copy your Client ID and Client Secret from Google Cloud Console</li>
                <li>Switch to the "Environment" tab in this configuration modal</li>
                <li>Paste your credentials into the respective fields</li>
                <li>Click "Save Configuration"</li>
                <li>The page will refresh to apply the new settings</li>
              </ol>
            </Callout>

            <Callout variant="danger">
              <h4 className="font-semibold mb-2">Alternative Method (Not Recommended)</h4>
              <p className="text-sm mb-2">
                Create a <code>.env</code> file in your project root (DO NOT commit real credentials):
              </p>
              <div className="bg-gray-900 text-green-400 rounded p-3 text-xs font-mono overflow-x-auto">
                <div># Copy this file to .env and replace with your credentials</div>
                <div>VITE_GOOGLE_CLIENT_ID=your_client_id_here</div>
                <div>VITE_GOOGLE_CLIENT_SECRET=your_client_secret_here</div>
                <div>VITE_GOOGLE_REDIRECT_URI={redirectUri}</div>
              </div>
            </Callout>
          </div>
        </div>

        {/* Troubleshooting Section */}
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Troubleshooting &amp; Common Issues</h3>

          <div className="space-y-3 text-sm">
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-1">🔴 "Gmail OAuth not configured" Error</h4>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1 ml-2">
                <li>Verify your Client ID and Client Secret are correctly entered in the Environment tab</li>
                <li>Check that the redirect URI exactly matches what you configured in Google Cloud Console</li>
                <li>Ensure the Gmail API is enabled in your Google Cloud project</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-1">🔴 "Access Denied" or "Unauthorized Client" Error</h4>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1 ml-2">
                <li>Check that your email is added as a test user in the OAuth consent screen</li>
                <li>Verify the authorized JavaScript origins include your current domain</li>
                <li>Make sure the OAuth consent screen is configured with the required scopes</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-1">🔴 "Invalid Redirect URI" Error</h4>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1 ml-2">
                <li>The redirect URI must EXACTLY match what's configured in Google Cloud Console</li>
                <li>Include the protocol (http:// or https://)</li>
                <li>For localhost, use the exact port number (e.g., http://localhost:5173)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-1">💡 General Tips</h4>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1 ml-2">
                <li>Open browser developer tools (F12) to see detailed error messages</li>
                <li>Make sure all URLs match exactly between Google Cloud Console and this application</li>
                <li>If changes don't take effect, try clearing browser cache and refreshing the page</li>
                <li>For production deployment, consider implementing server-side OAuth for better security</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {onSwitchToEnvironment && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">Ready to configure your OAuth credentials?</p>
          <Button
            onClick={onSwitchToEnvironment}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Go to Environment Configuration
          </Button>
        </div>
      )}
    </div>
  );
};
