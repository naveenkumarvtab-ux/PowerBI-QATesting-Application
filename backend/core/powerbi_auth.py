import msal
import requests
from backend.config import Config

class PowerBIAuthService:
    def __init__(self):
        self.authority = f"https://login.microsoftonline.com/{Config.TENANT_ID}" if Config.TENANT_ID else "https://login.microsoftonline.com/common"
        self.scopes = ["https://analysis.windows.net/powerbi/api/.default"]
        
    def get_service_principal_token(self):
        """
        Acquire AAD access token using client credentials flow (Service Principal).
        """
        if Config.MOCK_SERVICE:
            return "MOCK_SP_ACCESS_TOKEN_12345"
            
        if not (Config.CLIENT_ID and Config.CLIENT_SECRET and Config.TENANT_ID):
            raise ValueError("Azure AD Client credentials or Tenant ID are missing. Set them in .env or enable MOCK_SERVICE.")
            
        app = msal.ConfidentialClientApplication(
            Config.CLIENT_ID,
            authority=self.authority,
            client_credential=Config.CLIENT_SECRET
        )
        
        result = app.acquire_token_for_client(scopes=self.scopes)
        if "access_token" in result:
            return result["access_token"]
        else:
            error_desc = result.get("error_description", "Unknown error acquiring token")
            raise Exception(f"Failed to acquire Service Principal token: {error_desc}")

    def get_auth_url(self, redirect_uri, state=None):
        """
        Generate authorization URL for Delegated User OAuth Flow (Auth Code Flow).
        """
        if Config.MOCK_SERVICE:
            # Just return a simulated auth url pointing back to redirect_uri with mock code
            return f"{redirect_uri}?code=mock_auth_code_12345&state={state or ''}"

        if not Config.CLIENT_ID:
            raise ValueError("Azure AD CLIENT_ID is missing. Set it in .env or enable MOCK_SERVICE.")

        app = msal.ConfidentialClientApplication(
            Config.CLIENT_ID,
            authority=self.authority,
            client_credential=Config.CLIENT_SECRET  # MSAL can use confidential app to swap delegated code later
        )
        
        # Power BI scopes for user access
        scopes = [
            "https://analysis.windows.net/powerbi/api/Report.Read.All",
            "https://analysis.windows.net/powerbi/api/Dataset.Read.All",
            "https://analysis.windows.net/powerbi/api/Workspace.Read.All"
        ]
        
        auth_url = app.get_authorization_request_url(
            scopes,
            redirect_uri=redirect_uri,
            state=state
        )
        return auth_url

    def acquire_token_by_auth_code(self, code, redirect_uri):
        """
        Exchange authorization code for access token.
        """
        if Config.MOCK_SERVICE:
            return {
                "access_token": "MOCK_DELEGATED_ACCESS_TOKEN_12345",
                "refresh_token": "MOCK_DELEGATED_REFRESH_TOKEN_12345",
                "username": "demo_user@yourdomain.onmicrosoft.com"
            }

        app = msal.ConfidentialClientApplication(
            Config.CLIENT_ID,
            authority=self.authority,
            client_credential=Config.CLIENT_SECRET
        )
        
        scopes = [
            "https://analysis.windows.net/powerbi/api/Report.Read.All",
            "https://analysis.windows.net/powerbi/api/Dataset.Read.All",
            "https://analysis.windows.net/powerbi/api/Workspace.Read.All"
        ]
        
        result = app.acquire_token_by_authorization_code(
            code,
            scopes=scopes,
            redirect_uri=redirect_uri
        )
        
        if "access_token" in result:
            return {
                "access_token": result["access_token"],
                "refresh_token": result.get("refresh_token"),
                "username": result.get("id_token_claims", {}).get("preferred_username", "Unknown User")
            }
        else:
            error_desc = result.get("error_description", "Unknown error exchanging auth code")
            raise Exception(f"Failed to acquire user token: {error_desc}")
