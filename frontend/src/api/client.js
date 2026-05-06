import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:8000",
  timeout: 15000,
});

export default client;
