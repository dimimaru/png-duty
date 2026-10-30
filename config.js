// Production configuration: set both values once before publishing.
// This file is PUBLIC. Restrict the API key to the Sheets API and your site's HTTP referrer.
export const DEFAULT_CONFIG = {
  spreadsheetId: '', // The ID of a native, publicly readable Google Sheet.
  apiKey: ''           // Browser API key; never place service-account private keys here.
};
