import msal
import requests
from backend.config import Config

AUTH_FLOWS = {}

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

    def get_auth_url(self, redirect_uri, state=None, client_id=None, tenant_id=None, client_secret=None):
        """
        Generate authorization URL for Delegated User OAuth Flow with PKCE support.
        """
        effective_client_id = client_id or Config.CLIENT_ID
        effective_client_secret = client_secret or Config.CLIENT_SECRET
        effective_tenant_id = tenant_id or Config.TENANT_ID or "common"
        effective_authority = f"https://login.microsoftonline.com/{effective_tenant_id}"

        if not effective_client_id:
            raise ValueError(
                "Microsoft Azure App Registration (Client ID) is required to sign in with your corporate Microsoft account. "
                "Please provide a Client ID or configure it in the backend settings."
            )

        scopes = [
            "https://analysis.windows.net/powerbi/api/Report.Read.All",
            "https://analysis.windows.net/powerbi/api/Dataset.Read.All",
            "https://analysis.windows.net/powerbi/api/Workspace.Read.All"
        ]

        if effective_client_secret:
            app = msal.ConfidentialClientApplication(
                effective_client_id,
                authority=effective_authority,
                client_credential=effective_client_secret
            )
        else:
            app = msal.PublicClientApplication(
                effective_client_id,
                authority=effective_authority
            )

        # MSAL initiate_auth_code_flow generates PKCE code_challenge & code_verifier automatically
        flow = app.initiate_auth_code_flow(scopes, redirect_uri=redirect_uri, state=state)
        flow_state = flow.get("state")
        AUTH_FLOWS[flow_state] = {
            "flow": flow,
            "client_id": effective_client_id,
            "client_secret": effective_client_secret,
            "tenant_id": effective_tenant_id,
            "authority": effective_authority
        }
        
        return flow.get("auth_uri")

    def acquire_token_by_auth_code(self, code, redirect_uri, state=None, client_id=None, client_secret=None, tenant_id=None):
        """
        Exchange authorization code for access token using stored PKCE flow.
        """
        if code == "mock_auth_code_12345":
            return {
                "access_token": "MOCK_DELEGATED_ACCESS_TOKEN_12345",
                "refresh_token": "MOCK_DELEGATED_REFRESH_TOKEN_12345",
                "username": "demo_user@yourdomain.onmicrosoft.com"
            }

        saved_flow_entry = AUTH_FLOWS.pop(state, None) if state else None
        if saved_flow_entry:
            flow = saved_flow_entry["flow"]
            effective_client_id = saved_flow_entry["client_id"]
            effective_client_secret = saved_flow_entry["client_secret"]
            effective_authority = saved_flow_entry["authority"]

            if effective_client_secret:
                app = msal.ConfidentialClientApplication(
                    effective_client_id,
                    authority=effective_authority,
                    client_credential=effective_client_secret
                )
            else:
                app = msal.PublicClientApplication(
                    effective_client_id,
                    authority=effective_authority
                )

            result = app.acquire_token_by_auth_code_flow(flow, {"code": code, "state": state})
        else:
            effective_client_id = client_id or Config.CLIENT_ID
            effective_client_secret = client_secret or Config.CLIENT_SECRET
            effective_tenant_id = tenant_id or Config.TENANT_ID or "common"
            effective_authority = f"https://login.microsoftonline.com/{effective_tenant_id}"

            if not effective_client_id:
                raise ValueError("Azure AD CLIENT_ID is missing.")

            scopes = [
                "https://analysis.windows.net/powerbi/api/Report.Read.All",
                "https://analysis.windows.net/powerbi/api/Dataset.Read.All",
                "https://analysis.windows.net/powerbi/api/Workspace.Read.All"
            ]

            if effective_client_secret:
                app = msal.ConfidentialClientApplication(
                    effective_client_id,
                    authority=effective_authority,
                    client_credential=effective_client_secret
                )
            else:
                app = msal.PublicClientApplication(
                    effective_client_id,
                    authority=effective_authority
                )
            result = app.acquire_token_by_authorization_code(
                code,
                scopes=scopes,
                redirect_uri=redirect_uri
            )
        
        if "access_token" in result:
            return {
                "access_token": result["access_token"],
                "refresh_token": result.get("refresh_token"),
                "username": result.get("id_token_claims", {}).get("preferred_username") or result.get("id_token_claims", {}).get("upn") or "Microsoft User"
            }
        else:
            error_desc = result.get("error_description") or result.get("error") or "Unknown error exchanging auth code"
            raise Exception(f"Failed to acquire token from Microsoft: {error_desc}")
