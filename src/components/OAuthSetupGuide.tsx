import React from 'react';
import { ExternalLink, AlertTriangle, CheckCircle, Copy, ArrowRight } from 'lucide-react';

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
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-yellow-800 mb-2">Security Notice</h3>
            <p className="text-yellow-700 text-sm">
              This OAuth implementation is designed for PERSONAL/DEVELOPMENT use only. 
              OAuth tokens are handled client-side and client secrets are exposed to the browser.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-800 mb-2">Demo Mode Available</h3>
            <p className="text-blue-700 text-sm">
              The application works in demo mode without OAuth setup. For real Gmail integration, follow the steps below.
              You can complete this entire setup process without leaving this application!
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Step 1: Create Google Cloud Project */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
            Create Google Cloud Project
          </h3>
          <div className="space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>
                Go to{' '}
                <a 
                  href="https://console.cloud.google.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
                >
                  Google Cloud Console
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Create a new project or select an existing one</li>
              <li>Enable the Gmail API in "APIs & Services" → "Library"</li>
            </ol>
          </div>
        </div>

        {/* Step 2: Configure OAuth Consent Screen */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
            Configure OAuth Consent Screen
          </h3>
          <div className="space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>Go to "APIs & Services" → "OAuth consent screen"</li>
              <li>Select "External" user type</li>
              <li>Fill in required information (app name, support email)</li>
              <li>Add these scopes:</li>
            </ol>
            <div className="bg-gray-50 rounded p-3 space-y-1">
              <div className="flex items-center justify-between">
                <code className="text-xs">https://www.googleapis.com/auth/gmail.readonly</code>
                <button
                  onClick={() => copyToClipboard('https://www.googleapis.com/auth/gmail.readonly')}
                  className="text-gray-500 hover:text-gray-700"
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <code className="text-xs">https://www.googleapis.com/auth/gmail.modify</code>
                <button
                  onClick={() => copyToClipboard('https://www.googleapis.com/auth/gmail.modify')}
                  className="text-gray-500 hover:text-gray-700"
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-700">5. Add your email as a test user</p>
          </div>
        </div>

        {/* Step 3: Create OAuth Client ID */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
            Create OAuth Client ID
          </h3>
          <div className="space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>Navigate to "APIs & Services" → "Credentials"</li>
              <li>Click "Create Credentials" → "OAuth client ID"</li>
              <li>Choose "Web application"</li>
              <li>Add authorized JavaScript origins:</li>
            </ol>
            <div className="bg-gray-50 rounded p-3">
              <div className="flex items-center justify-between">
                <code className="text-xs">{currentOrigin}</code>
                <button
                  onClick={() => copyToClipboard(currentOrigin)}
                  className="text-gray-500 hover:text-gray-700"
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-700">5. Add authorized redirect URIs:</p>
            <div className="bg-gray-50 rounded p-3">
              <div className="flex items-center justify-between">
                <code className="text-xs">{redirectUri}</code>
                <button
                  onClick={() => copyToClipboard(redirectUri)}
                  className="text-gray-500 hover:text-gray-700"
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Completion Checklist */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="bg-green-100 text-green-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">✓</span>
            Setup Completion Checklist
          </h3>
          <div className="space-y-2">
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" className="rounded border-gray-300" />
              <span>Google Cloud project created and Gmail API enabled</span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" className="rounded border-gray-300" />
              <span>OAuth consent screen configured with required scopes</span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" className="rounded border-gray-300" />
              <span>OAuth client ID created with correct authorized origins and redirect URIs</span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" className="rounded border-gray-300" />
              <span>Client ID and Client Secret copied to the Environment tab</span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" className="rounded border-gray-300" />
              <span>Configuration saved and page refreshed</span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" className="rounded border-gray-300" />
              <span>Successfully connected to Gmail (green "Connect Gmail" button)</span>
            </label>
          </div>
        </div>
        
        {/* Step 4: Configure Application */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</span>
            Configure Application
          </h3>
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded p-4">
              <h4 className="font-semibold text-green-800 mb-2">✅ Secure Method (Recommended)</h4>
              <p className="text-green-700 text-sm mb-2">
                Use this configuration panel to enter your OAuth credentials:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-green-700">
                <li>Copy your Client ID and Client Secret from Google Cloud Console</li>
                <li>Switch to the "Environment" tab in this configuration modal</li>
                <li>Paste your credentials into the respective fields</li>
                <li>Click "Save Configuration"</li>
                <li>The page will refresh to apply the new settings</li>
              </ol>
            </div>

            <div className="bg-red-50 border border-red-200 rounded p-4">
              <h4 className="font-semibold text-red-800 mb-2">⚠️ Alternative Method (Not Recommended)</h4>
              <p className="text-red-700 text-sm mb-2">
                Create a <code>.env</code> file in your project root (DO NOT commit real credentials):
              </p>
              <div className="bg-gray-900 text-green-400 rounded p-3 text-xs font-mono overflow-x-auto">
                <div># Copy this file to .env and replace with your credentials</div>
                <div>VITE_GOOGLE_CLIENT_ID=your_client_id_here</div>
                <div>VITE_GOOGLE_CLIENT_SECRET=your_client_secret_here</div>
                <div>VITE_GOOGLE_REDIRECT_URI={redirectUri}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Troubleshooting Section */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Troubleshooting & Common Issues</h3>
          
          <div className="space-y-3 text-sm">
            <div>
              <h4 className="font-medium text-gray-700 mb-1">🔴 "Gmail OAuth not configured" Error</h4>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
                <li>Verify your Client ID and Client Secret are correctly entered in the Environment tab</li>
                <li>Check that the redirect URI exactly matches what you configured in Google Cloud Console</li>
                <li>Ensure the Gmail API is enabled in your Google Cloud project</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-700 mb-1">🔴 "Access Denied" or "Unauthorized Client" Error</h4>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
                <li>Check that your email is added as a test user in the OAuth consent screen</li>
                <li>Verify the authorized JavaScript origins include your current domain</li>
                <li>Make sure the OAuth consent screen is configured with the required scopes</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-700 mb-1">🔴 "Invalid Redirect URI" Error</h4>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
                <li>The redirect URI must EXACTLY match what's configured in Google Cloud Console</li>
                <li>Include the protocol (http:// or https://)</li>
                <li>For localhost, use the exact port number (e.g., http://localhost:5173)</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-700 mb-1">💡 General Tips</h4>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
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
        <div className="pt-3 border-t border-gray-200">
          <p className="text-sm text-gray-700 mb-2">Ready to configure your OAuth credentials?</p>
          <button
            onClick={onSwitchToEnvironment}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Environment Configuration
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
