import { useRef, useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  Undo2,
  Redo2,
  Download,
  Copy,
  Check,
  Code,
  AlertCircle,
  CheckCircle2,
  Moon,
  Sun,
} from "lucide-react";
import cssbeautify from "cssbeautify";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import "../../assets/css/editor/CSSEditor.css";

export default function CSSEditor() {
  const { state, setCustomCss } = useApp();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [cssErrors, setCssErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [editorHeight, setEditorHeight] = useState("400px");

  // Basic CSS validation
  const validateCSS = (css: string): string[] => {
    const errors: string[] = [];
    const lines = css.split("\n");

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("/*") || trimmed.startsWith("*"))
        return;

      // Check for unclosed braces (for future validation)
      // const openBraces = (line.match(/{/g) || []).length;
      // const closeBraces = (line.match(/}/g) || []).length;

      // Check for common syntax errors
      if (
        trimmed.includes(":") &&
        !trimmed.includes(";") &&
        !trimmed.endsWith("{") &&
        !trimmed.endsWith("}")
      ) {
        // Might be incomplete, but not necessarily an error
      }

      // Check for unmatched quotes
      const singleQuotes = (line.match(/'/g) || []).length;
      const doubleQuotes = (line.match(/"/g) || []).length;
      if (singleQuotes % 2 !== 0) {
        errors.push(`Line ${index + 1}: Unmatched single quote`);
      }
      if (doubleQuotes % 2 !== 0) {
        errors.push(`Line ${index + 1}: Unmatched double quote`);
      }
    });

    return errors;
  };

  const handleChange = (value: string | undefined) => {
    if (value === undefined) return;
    setCustomCss(value);

    // Validate CSS with debounce
    setIsValidating(true);
    setTimeout(() => {
      const errors = validateCSS(value);
      setCssErrors(errors);
      setIsValidating(false);
    }, 500);
  };

  const handleEditorDidMount = (editorInstance: editor.IStandaloneCodeEditor) => {
    editorRef.current = editorInstance;
  };

  // Format CSS using cssbeautify
  const formatCSS = async () => {
    const css = state.editor.customCss.trim();
    if (!css) return;

    try {
      const formatted = cssbeautify(css, {
        indent: "  ", // 2 spaces
        openbrace: "end-of-line",
        autosemicolon: true,
      });
      setCustomCss(formatted);
      
      // Format using Monaco's built-in formatter as well
      if (editorRef.current) {
        await editorRef.current.getAction("editor.action.formatDocument")?.run();
      }
    } catch (error) {
      console.error("Error formatting CSS:", error);
      // If formatting fails, show an error but don't break the editor
      setCssErrors([
        ...cssErrors,
        "Failed to format CSS. Please check for syntax errors.",
      ]);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(state.editor.customCss);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([state.editor.customCss], { type: "text/css" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "custom-styles.css";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Calculate editor height based on container
  useEffect(() => {
    const updateHeight = () => {
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setEditorHeight(`${Math.max(400, window.innerHeight - rect.top - 200)}px`);
      }
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // Update theme when isDarkTheme changes
  useEffect(() => {
    if (editorRef.current) {
      const theme = isDarkTheme ? "vs-dark" : "vs";
      editorRef.current.updateOptions({
        theme: theme,
      });
    }
  }, [isDarkTheme]);

  return (
    <div className="css-editor-container">
      <div className="css-editor-toolbar">
        <div className="toolbar-group">
          <button
            className="toolbar-btn"
            onClick={() => {
              editorRef.current?.trigger("keyboard", "undo", null);
            }}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            className="toolbar-btn"
            onClick={() => {
              editorRef.current?.trigger("keyboard", "redo", null);
            }}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={16} />
          </button>
        </div>
        <div className="toolbar-group">
          <button
            className="toolbar-btn"
            onClick={formatCSS}
            title="Format CSS"
          >
            <Code size={16} />
          </button>
          <button className="toolbar-btn" onClick={handleCopy} title="Copy CSS">
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button
            className="toolbar-btn"
            onClick={handleDownload}
            title="Download CSS"
          >
            <Download size={16} />
          </button>
          <button
            className="toolbar-btn"
            onClick={() => setIsDarkTheme(!isDarkTheme)}
            title={isDarkTheme ? "Light Theme" : "Dark Theme"}
          >
            {isDarkTheme ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
      {cssErrors.length > 0 && (
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "4px",
            margin: "8px",
            fontSize: "12px",
            color: "#ef4444",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "4px",
            }}
          >
            <AlertCircle size={14} />
            <strong>CSS Validation Issues:</strong>
          </div>
          {cssErrors.map((error, idx) => (
            <div key={idx} style={{ marginLeft: "20px" }}>
              • {error}
            </div>
          ))}
        </div>
      )}

      <div className="css-editor-wrapper" ref={wrapperRef}>
        <Editor
          height={editorHeight}
          language="css"
          value={state.editor.customCss}
          onChange={handleChange}
          onMount={handleEditorDidMount}
          theme={isDarkTheme ? "vs-dark" : "vs"}
          options={{
            fontSize: 13,
            fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace",
            lineHeight: 1.6,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "off",
            lineNumbers: "on",
            renderLineHighlight: "all",
            selectOnLineNumbers: true,
            roundedSelection: false,
            readOnly: false,
            cursorStyle: "line",
            cursorBlinking: "smooth",
            folding: true,
            showFoldingControls: "always",
            matchBrackets: "always",
            autoIndent: "full",
            formatOnPaste: false,
            formatOnType: false,
            padding: { top: 12, bottom: 12 },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: "on",
            snippetSuggestions: "top",
            wordBasedSuggestions: "off",
          }}
        />
      </div>
      <div className="editor-footer">
        <span className="footer-info">
          {state.editor.customCss.split("\n").length} lines
        </span>
        <span className="footer-info">
          {state.editor.customCss.length} characters
        </span>
        <span className="footer-info">
          {
            state.editor.customCss.split(/\s+/).filter((w) => w.length > 0)
              .length
          }{" "}
          words
        </span>
        <span className="footer-status">
          {isValidating
            ? "Validating..."
            : cssErrors.length > 0
              ? `${cssErrors.length} issue(s)`
              : "Live Preview Active"}
        </span>
        {!isValidating &&
          cssErrors.length === 0 &&
          state.editor.customCss.trim() && (
            <div
              style={{
                borderRadius: "4px",
                color: "#22c55e",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <CheckCircle2 size={14} />
            </div>
          )}
      </div>
    </div>
  );
}
