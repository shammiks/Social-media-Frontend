// utils/api.js
import axios from "axios";

const API = axios.create({
  baseURL: "http://192.168.1.10:8080/api", // replace <your-ip> with your actual backend IP (same network)
});

export default API;
