// utils/api.js
import axios from "axios";

const API = axios.create({
  baseURL: "http://192.168.1.3:8080/api", // Updated to match your actual IP address
});

export default API;
