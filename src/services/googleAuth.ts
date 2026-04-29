import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback'
);

export const generateAuthUrl = () => {
  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });
};

export const getTokenFromCode = async (code: string) => {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return tokens;
};

export const setCredentials = (credentials: any) => {
  oauth2Client.setCredentials(credentials);
};

export const getAuthClient = () => {
  return oauth2Client;
};

export const revokeToken = async (token: string) => {
  await oauth2Client.revokeToken(token);
};

export const getAccessTokenFromRefresh = async (refreshToken: string) => {
  const oldRefresh = oauth2Client.credentials.refresh_token;
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  if (oldRefresh) {
    oauth2Client.setCredentials({ refresh_token: oldRefresh });
  }
  return credentials.access_token;
};
