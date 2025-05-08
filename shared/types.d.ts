// Type declarations for modules without declaration files

declare module 'speakeasy' {
  export namespace totp {
    export function generate(options: {
      secret: string;
      encoding?: string;
    }): string;
    
    export function verify(options: {
      secret: string;
      encoding?: string;
      token: string;
      window?: number;
    }): boolean;
  }
  
  export function generateSecret(options?: {
    name?: string;
    length?: number;
    symbols?: boolean;
    otpauth_url?: boolean;
  }): {
    ascii: string;
    hex: string;
    base32: string;
    otpauth_url?: string;
  };
}

declare module 'qrcode' {
  export function toDataURL(text: string, options?: any): Promise<string>;
}

// Extend the express-session to include SessionStore
declare module 'express-session' {
  interface SessionStore {
    all: (...args: any[]) => any;
    destroy: (...args: any[]) => any;
    clear: (...args: any[]) => any;
    length: (...args: any[]) => any;
    get: (...args: any[]) => any;
    set: (...args: any[]) => any;
    touch: (...args: any[]) => any;
  }
}