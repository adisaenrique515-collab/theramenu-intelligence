/// <reference types="vite/client" />

declare module 'html2pdf.js' {
  const html2pdf: any;
  export default html2pdf;
}

export {};

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
