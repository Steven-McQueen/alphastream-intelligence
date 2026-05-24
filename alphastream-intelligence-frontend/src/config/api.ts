/**
 * Centralized API Configuration
 *
 * All API calls should import API_BASE_URL from this file instead of hardcoding URLs.
 * The URL can be configured via VITE_API_BASE_URL environment variable.
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default API_BASE_URL;
