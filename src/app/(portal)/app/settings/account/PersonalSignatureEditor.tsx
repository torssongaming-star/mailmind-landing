"use client";

import { useState, useRef, useEffect } from "react";
import { updatePersonalSignature, updateAppendSignature } from "./actions";

// Inline SVG Icons for Visual Editor Toolbar
const BoldIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h8a4 4 0 100-8H6v8zm0 0h9a4 4 0 110 8H6v-8z" />
  </svg>
);

const ItalicIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m-4 0h4m-6 16h4" />
  </svg>
);

const LinkIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const ImageIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const ClearIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export function PersonalSignatureEditor({
  initialSignature,
  initialAppendSignature,
}: {
  initialSignature: string | null;
  initialAppendSignature: boolean;
}) {
  const [isPending, setIsPending]         = useState(false);
  const [status, setStatus]               = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg]           = useState<string | null>(null);
  const [appendSig, setAppendSig]         = useState(initialAppendSignature);
  const [togglePending, setTogglePending] = useState(false);
  
  // Navigation: visual editor, raw HTML editor, or static preview
  const [preview, setPreview]             = useState<"visual" | "html" | "preview">("visual");

  const [rawHtml, setRawHtml]             = useState(initialSignature ?? "");
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync cursor/contenteditable content across tab switching or external resets
  useEffect(() => {
    if (preview === "visual" && editorRef.current) {
      if (editorRef.current.innerHTML !== rawHtml && document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = rawHtml;
      }
    }
  }, [preview, rawHtml]);

  // Canvas-based image compression: max 600px width/height & 80% JPEG compression
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const MAX_DIM = 600;

          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (ctx) {
            // Determine output type (preserve PNG for transparency)
            const outputType = file.type === "image/png" || file.type === "image/webp" 
              ? file.type 
              : "image/jpeg";
              
            // If we are outputting a JPEG, we should fill the background with white first 
            // in case the source image had transparent areas.
            if (outputType === "image/jpeg") {
               ctx.fillStyle = "#FFFFFF";
               ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  resolve(blob);
                } else {
                  resolve(file);
                }
              },
              outputType,
              outputType === "image/jpeg" ? 0.8 : undefined // PNG doesn't use quality param
            );
          } else {
            resolve(file);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Helper to insert HTML nodes at current caret/cursor position
  const insertHtmlAtCursor = (html: string) => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const el = document.createElement("div");
    el.innerHTML = html;
    const frag = document.createDocumentFragment();
    let node: Node | null;
    let lastNode: Node | null = null;

    while ((node = el.firstChild)) {
      lastNode = frag.appendChild(node);
    }
    range.insertNode(frag);

    if (lastNode) {
      const newRange = document.createRange();
      newRange.setStartAfter(lastNode);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  };

  const insertHtml = (html: string) => {
    const selection = window.getSelection();
    const editorEl = editorRef.current;
    if (!editorEl) return;

    let isInside = false;
    if (selection && selection.rangeCount > 0) {
      let node: Node | null = selection.getRangeAt(0).startContainer;
      while (node) {
        if (node === editorEl) {
          isInside = true;
          break;
        }
        node = node.parentNode;
      }
    }

    if (isInside) {
      insertHtmlAtCursor(html);
    } else {
      editorEl.innerHTML += html;
    }

    setRawHtml(editorEl.innerHTML);
  };

  // Core image upload and insert method
  const uploadAndInsertImage = async (file: File) => {
    setIsUploadingImage(true);
    try {
      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], file.name || "image.jpg", {
        type: compressedBlob.type,
      });

      const formData = new FormData();
      formData.append("file", compressedFile);

      const res = await fetch("/api/app/signature/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Kunde inte ladda upp bilden.");
      }

      const { url } = await res.json();
      insertHtml(`<img src="${url}" alt="Signaturbild" style="max-width: 100%; height: auto; display: block; margin: 8px 0;" />`);
    } catch (error) {
      console.error("Paste image error:", error);
      alert(error instanceof Error ? error.message : "Ett fel uppstod vid uppladdning av bilden.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Intercept paste events to handle clipboard screenshots or pasted images from Outlook/files
  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData.items;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await uploadAndInsertImage(file);
        }
        break;
      }
    }
  };

  // Drag and drop handlers to drop local image files directly
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith("image/")) {
          await uploadAndInsertImage(file);
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const executeCommand = (command: string, value: string = "") => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setRawHtml(editorRef.current.innerHTML);
    }
  };

  const handleLinkCommand = () => {
    const url = prompt("Ange länk-URL:", "https://");
    if (url) {
      executeCommand("createLink", url);
    }
  };

  const handleSave = async () => {
    setIsPending(true);
    setStatus("idle");
    setErrorMsg(null);

    try {
      const res = await updatePersonalSignature(rawHtml);
      if (res && !res.ok) {
        throw new Error(res.error || "Ett oväntat fel uppstod");
      }
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Okänt fel uppstod");
    } finally {
      setIsPending(false);
    }
  };

  const handleToggle = async () => {
    const newValue = !appendSig;
    setAppendSig(newValue);
    setTogglePending(true);
    try {
      await updateAppendSignature(newValue);
    } catch {
      setAppendSig(!newValue);
    } finally {
      setTogglePending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 p-6 md:p-8 backdrop-blur-sm">
      <div className="max-w-2xl">
        <h2 className="text-base font-semibold text-white">Personlig e-postsignatur</h2>
        <p className="text-sm text-slate-400 mt-1">
          Din signatur läggs till längst ner i e-post när du godkänner AI-utkast. Du kan kopiera/klistra in bilder eller dra och släppa dem.
        </p>

        <div className="mt-6 space-y-4">
          {/* Tab selector */}
          <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-1 w-fit">
            <button
              onClick={() => setPreview("visual")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                preview === "visual"
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Visuell redigering
            </button>
            <button
              onClick={() => setPreview("html")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                preview === "html"
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              HTML-kod
            </button>
            <button
              onClick={() => setPreview("preview")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                preview === "preview"
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Förhandsgranska
            </button>
          </div>

          {/* Hidden File Input for Toolbar Image Button */}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                await uploadAndInsertImage(file);
              }
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            }}
          />

          {/* Visual WYSIWYG Editor View */}
          {preview === "visual" && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Skriv eller klistra in din signatur
              </label>

              {/* WYSIWYG Toolbar */}
              <div className="flex items-center gap-1.5 p-2 bg-white/[0.03] border border-white/10 rounded-t-xl">
                <button
                  type="button"
                  title="Fet"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeCommand("bold");
                  }}
                  className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  <BoldIcon />
                </button>
                <button
                  type="button"
                  title="Kursiv"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeCommand("italic");
                  }}
                  className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  <ItalicIcon />
                </button>
                <button
                  type="button"
                  title="Infoga länk"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleLinkCommand();
                  }}
                  className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  <LinkIcon />
                </button>
                <button
                  type="button"
                  title="Infoga bild"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }}
                  className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  <ImageIcon />
                </button>
                <div className="w-[1px] h-4 bg-white/10 mx-1" />
                <button
                  type="button"
                  title="Rensa formatering"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeCommand("removeFormat");
                  }}
                  className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all ml-auto"
                >
                  <ClearIcon />
                </button>
              </div>

              {/* Interactive Editor Canvas */}
              <div className="relative">
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => setRawHtml(e.currentTarget.innerHTML)}
                  onPaste={handlePaste}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="w-full min-h-[220px] rounded-b-xl bg-white border border-t-0 border-white/10 p-4 md:p-6 text-sm text-slate-900 focus:outline-none overflow-y-auto focus:ring-1 focus:ring-cyan-400/20"
                  style={{ color: "#0f172a" }} // force dark slate body content
                />

                {/* Upload overlay */}
                {isUploadingImage && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs rounded-b-xl transition-all">
                    <svg className="animate-spin h-8 w-8 text-cyan-400 mb-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-xs text-white font-medium">Laddar upp och komprimerar bild...</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-500">
                Tips: Klistra in en e-postsignatur (inklusive bilder och länkar) direkt i den vita ytan ovan. Bilder komprimeras automatiskt för snabb laddning.
              </p>
            </div>
          )}

          {/* Raw HTML Textarea View */}
          {preview === "html" && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                HTML-kod för signaturen
              </label>
              <textarea
                value={rawHtml}
                onChange={(e) => setRawHtml(e.target.value)}
                rows={10}
                placeholder='Klistra in HTML-koden för din signatur här, t.ex. <p>Emil Torsson<br/><a href="mailto:...">...</a></p>'
                className="w-full rounded-xl bg-[#0A1025] border border-white/10 px-4 py-3 text-xs text-white/80 font-mono focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/20 transition-all resize-y"
              />
              <p className="text-xs text-slate-500 mt-2">
                Tips: Du kan redigera den råa källkoden här om du vill finjustera marginaler, stilar eller taggar manuellt.
              </p>
            </div>
          )}

          {/* Static Read-only Preview */}
          {preview === "preview" && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Förhandsvisning (hur mottagaren ser mejlet)
              </label>
              <div
                className="w-full min-h-[120px] rounded-xl bg-white px-5 py-4 text-sm overflow-auto text-slate-900 border border-white/10"
                style={{ color: "#0f172a" }}
                dangerouslySetInnerHTML={{ __html: rawHtml || "<em style='color:#64748b'>Din signatur är tom…</em>" }}
              />
            </div>
          )}

          {/* Toggle: Bifoga signatur i AI-utkast */}
          <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-white">Bifoga signatur i AI-utkast</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {appendSig
                  ? "Din signatur läggs till automatiskt när du skickar AI-svar."
                  : "Din signatur bifogas inte automatiskt. Du kan aktivera det när som helst."}
              </p>
            </div>
            <button
              onClick={handleToggle}
              disabled={togglePending}
              aria-checked={appendSig}
              role="switch"
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:opacity-50 ${
                appendSig
                  ? "border-cyan-400/40 bg-cyan-400"
                  : "border-white/10 bg-white/10"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full shadow transition-transform duration-200 ease-in-out mt-0.5 ${
                  appendSig ? "translate-x-5 bg-[#030614]" : "translate-x-0.5 bg-white/60"
                }`}
              />
            </button>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isPending || isUploadingImage}
              className="h-10 px-6 rounded-xl bg-cyan-400 text-black font-bold text-sm hover:bg-cyan-300 transition-colors disabled:opacity-40"
            >
              {isPending ? "Sparar..." : "Spara signatur"}
            </button>

            {status === "success" && (
              <span className="text-sm text-green-400 font-medium flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Sparat!
              </span>
            )}
            {status === "error" && (
              <span className="text-sm text-red-400 font-medium">{errorMsg}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
