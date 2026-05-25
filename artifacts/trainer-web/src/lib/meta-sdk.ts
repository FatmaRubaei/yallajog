type FacebookLoginOptions = {
  config_id: string;
  response_type: "code";
  override_default_response_type: boolean;
  extras?: Record<string, unknown>;
};

type FacebookLoginResponse = {
  status?: string;
  authResponse?: {
    code?: string;
  };
};

export type FacebookSdk = {
  init: (options: {
    appId: string;
    autoLogAppEvents?: boolean;
    xfbml?: boolean;
    version: string;
  }) => void;
  login: (
    callback: (response: FacebookLoginResponse) => void,
    options: FacebookLoginOptions,
  ) => void;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

const FACEBOOK_SDK_ID = "facebook-jssdk";

export function loadFacebookSdk(appId: string): Promise<FacebookSdk> {
  if (window.FB) {
    window.FB.init({
      appId,
      autoLogAppEvents: true,
      xfbml: false,
      version: "v22.0",
    });
    return Promise.resolve(window.FB);
  }

  return new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      if (!window.FB) {
        reject(new Error("Facebook SDK did not initialize."));
        return;
      }

      window.FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: "v22.0",
      });

      resolve(window.FB);
    };

    const existingScript = document.getElementById(FACEBOOK_SDK_ID);
    if (existingScript) {
      return;
    }

    const script = document.createElement("script");
    script.id = FACEBOOK_SDK_ID;
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.onerror = () => reject(new Error("Failed to load Facebook SDK."));
    document.body.appendChild(script);
  });
}
