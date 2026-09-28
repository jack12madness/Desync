import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const BASE_URL = process.env.REACT_APP_BACKEND_URL;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  // Never clobber a caller-provided Authorization header (e.g. the customer
  // portal's buyer token) with the admin token.
  if (config.headers && config.headers.Authorization) {
    return config;
  }
  const token = localStorage.getItem("void_admin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function apiError(e) {
  const d = e?.response?.data?.detail;
  if (d == null) return e?.message || "Something went wrong. Please try again.";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d.map((x) => (x && typeof x.msg === "string" ? x.msg : JSON.stringify(x))).join(" ");
  }
  if (d && typeof d.msg === "string") return d.msg;
  return String(d);
}

export const aud = (n) => `A$${Number(n).toFixed(2)}`;
