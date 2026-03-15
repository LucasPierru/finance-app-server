export interface RegisterBody {
  email?: string;
  name?: string;
  phone?: string;
  birthDate?: string;
}

export interface RequestCodeBody {
  email?: string;
}

export interface VerifyCodeBody {
  email?: string;
  code?: string;
}

export interface RefreshBody {
  refreshToken?: string;
}

export interface LogoutBody {
  refreshToken?: string;
}