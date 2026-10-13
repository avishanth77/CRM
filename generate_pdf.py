import os
import re
import subprocess
import markdown
import fitz  # PyMuPDF

WORKSPACE_DIR = r"D:\texol\TEXOL CRM"
MD_FILE = os.path.join(WORKSPACE_DIR, "texol_crm_data_dictionary_and_field_guide.md")
HTML_FILE = os.path.join(WORKSPACE_DIR, "texol_crm_data_dictionary_and_field_guide.html")
PDF_WORKSPACE_FILE = os.path.join(WORKSPACE_DIR, "texol_crm_data_dictionary_and_field_guide.pdf")
PDF_ARTIFACT_DIR = r"C:\Users\User\.gemini\antigravity-ide\brain\d9a11c0f-bbda-4cc3-942e-f180930c8c2d"
PDF_ARTIFACT_FILE = os.path.join(PDF_ARTIFACT_DIR, "texol_crm_data_dictionary_and_field_guide.pdf")

# 1. Read Markdown content
with open(MD_FILE, "r", encoding="utf-8") as f:
    md_content = f.read()

# Replace mermaid codeblock with styled diagram container
mermaid_pattern = re.compile(r'```mermaid(.*?)```', re.DOTALL)
def replace_mermaid(match):
    content = match.group(1).strip()
    return f'<div class="diagram-box"><strong>Workflow Architecture:</strong><pre>{content}</pre></div>'
md_content = mermaid_pattern.sub(replace_mermaid, md_content)

# Convert Markdown to HTML
html_body = markdown.markdown(
    md_content,
    extensions=['tables', 'fenced_code', 'toc', 'attr_list', 'nl2br']
)

# Replace common badges with styled span tags
html_body = re.sub(r'<strong>Required</strong>', r'<span class="badge badge-required">Required</span>', html_body)
html_body = re.sub(r'<strong>Required if (.*?)</strong>', r'<span class="badge badge-required">Required if \1</span>', html_body)
html_body = re.sub(r'\bOptional\b', r'<span class="badge badge-optional">Optional</span>', html_body)
html_body = re.sub(r'\bAuto\b', r'<span class="badge badge-auto">Auto-Computed</span>', html_body)
html_body = re.sub(r'\bRead-only\b', r'<span class="badge badge-readonly">Read-only</span>', html_body)

# Full styled HTML Document
full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>TEXOL PLD CRM — Data Dictionary & Field Guide</title>
<style>
  @page {{
    size: A4 portrait;
    margin: 16mm 14mm 18mm 14mm;
  }}

  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1e293b;
    background: #ffffff;
    line-height: 1.5;
    font-size: 9.5pt;
    margin: 0;
    padding: 0;
  }}

  /* Cover Banner */
  .header-banner {{
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: #ffffff;
    padding: 24px 28px;
    border-radius: 8px;
    margin-bottom: 24px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }}
  .header-banner h1 {{
    margin: 0 0 6px 0;
    font-size: 20pt;
    color: #60a5fa;
    letter-spacing: -0.5px;
    font-weight: 700;
  }}
  .header-banner .subtitle {{
    margin: 0;
    font-size: 11pt;
    color: #cbd5e1;
    font-weight: 400;
  }}
  .header-meta {{
    margin-top: 14px;
    display: flex;
    gap: 20px;
    font-size: 8.5pt;
    color: #94a3b8;
    border-top: 1px solid #334155;
    padding-top: 10px;
  }}
  .header-meta span {{
    display: inline-block;
    margin-right: 18px;
  }}
  .header-meta strong {{
    color: #f1f5f9;
  }}

  /* Typography */
  h1 {{
    font-size: 16pt;
    color: #0f172a;
    border-bottom: 2px solid #3b82f6;
    padding-bottom: 4px;
    margin-top: 24px;
    margin-bottom: 12px;
    page-break-after: avoid;
  }}
  h2 {{
    font-size: 13pt;
    color: #1e3a8a;
    border-bottom: 1.5px solid #e2e8f0;
    padding-bottom: 4px;
    margin-top: 22px;
    margin-bottom: 10px;
    page-break-after: avoid;
  }}
  h3 {{
    font-size: 11pt;
    color: #2563eb;
    margin-top: 16px;
    margin-bottom: 8px;
    page-break-after: avoid;
  }}
  p {{
    margin: 6px 0 10px 0;
  }}

  /* Tables */
  table {{
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 18px 0;
    font-size: 8.5pt;
    page-break-inside: auto;
  }}
  tr {{
    page-break-inside: avoid;
    page-break-after: auto;
  }}
  thead {{
    display: table-header-group;
  }}
  th {{
    background-color: #0f172a;
    color: #ffffff;
    font-weight: 600;
    text-align: left;
    padding: 7px 8px;
    border: 1px solid #0f172a;
    letter-spacing: 0.2px;
  }}
  td {{
    padding: 6px 8px;
    border: 1px solid #cbd5e1;
    vertical-align: top;
    background-color: #ffffff;
  }}
  tbody tr:nth-child(even) td {{
    background-color: #f8fafc;
  }}

  /* Badges */
  .badge {{
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 7.5pt;
    font-weight: 600;
    white-space: nowrap;
  }}
  .badge-required {{
    background-color: #fee2e2;
    color: #991b1b;
    border: 1px solid #f87171;
  }}
  .badge-optional {{
    background-color: #f1f5f9;
    color: #475569;
    border: 1px solid #cbd5e1;
  }}
  .badge-auto {{
    background-color: #dbeafe;
    color: #1e40af;
    border: 1px solid #93c5fd;
  }}
  .badge-readonly {{
    background-color: #fef3c7;
    color: #92400e;
    border: 1px solid #fcd34d;
  }}

  /* Code / Monospace */
  code {{
    font-family: "Consolas", "Courier New", monospace;
    font-size: 8pt;
    background-color: #f1f5f9;
    color: #0369a1;
    padding: 1px 4px;
    border-radius: 3px;
    border: 1px solid #e2e8f0;
  }}

  /* Lists */
  ul, ol {{
    margin: 6px 0 12px 18px;
    padding: 0;
  }}
  li {{
    margin-bottom: 4px;
  }}

  /* Diagrams & Callouts */
  .diagram-box {{
    background-color: #f8fafc;
    border: 1px solid #cbd5e1;
    border-left: 4px solid #3b82f6;
    padding: 12px 16px;
    border-radius: 6px;
    margin: 14px 0;
  }}
  .diagram-box pre {{
    font-family: "Consolas", monospace;
    font-size: 8pt;
    color: #334155;
    margin: 6px 0 0 0;
    white-space: pre-wrap;
  }}

  /* Print Page Breaks */
  .page-break {{
    page-break-before: always;
  }}
</style>
</head>
<body>

<div class="header-banner">
  <h1>TEXOL PLD CRM</h1>
  <div class="subtitle">Complete Data Dictionary & Field Specification Guide</div>
  <div class="header-meta">
    <span><strong>System:</strong> Product-Led Distribution CRM</span>
    <span><strong>Edition:</strong> Enterprise Architecture v2.0</span>
    <span><strong>Coverage:</strong> All 14 Lifecycle Workspaces & Tables</span>
    <span><strong>Date:</strong> October 2026</span>
  </div>
</div>

{html_body}

</body>
</html>
"""

# Write HTML file
with open(HTML_FILE, "w", encoding="utf-8") as f:
    f.write(full_html)
print(f"Generated HTML: {HTML_FILE}")

# 2. Invoke Microsoft Edge Headless to print to PDF
edge_executable = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
cmd = [
    edge_executable,
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={PDF_WORKSPACE_FILE}",
    f"file:///{os.path.abspath(HTML_FILE)}"
]

print("Executing Edge print-to-pdf...")
result = subprocess.run(cmd, capture_output=True, text=True)
if result.returncode != 0:
    print("Edge Error:", result.stderr)
else:
    print(f"Successfully generated workspace PDF: {PDF_WORKSPACE_FILE}")

# Copy to artifacts directory
if os.path.exists(PDF_WORKSPACE_FILE):
    import shutil
    shutil.copyfile(PDF_WORKSPACE_FILE, PDF_ARTIFACT_FILE)
    print(f"Copied to artifact directory: {PDF_ARTIFACT_FILE}")

    # Inspect PDF with PyMuPDF
    doc = fitz.open(PDF_WORKSPACE_FILE)
    print(f"PDF Validation: Total Pages = {len(doc)}, File Size = {os.path.getsize(PDF_WORKSPACE_FILE):,} bytes")
    doc.close()
