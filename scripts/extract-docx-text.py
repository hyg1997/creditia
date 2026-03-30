import sys, re, zipfile

def extract_docx_text(path):
    with zipfile.ZipFile(path, 'r') as z:
        xml = z.read('word/document.xml').decode('utf-8')
    xml = re.sub(r'</w:p>', '\n', xml)
    xml = re.sub(r'<w:tab/>', '\t', xml)
    xml = re.sub(r'<w:br[^/]*/>', '\n', xml)
    text = re.sub(r'<[^>]+>', '', xml)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

print(extract_docx_text(sys.argv[1]))
