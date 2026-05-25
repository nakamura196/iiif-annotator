// Initialize ONNX Runtime Web
if (typeof window !== 'undefined') {
  // Load ONNX Runtime from CDN
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.js';
  script.async = false;
  document.head.appendChild(script);
}
