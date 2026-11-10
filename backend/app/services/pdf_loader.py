from pathlib import Path
from langchain_community.document_loaders import PyPDFium2Loader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

def load_and_split_pdf(file_path: str | Path, original_filename: str = None) -> list[Document]:
    """
    Loads a PDF file from the given path and splits it into smaller text chunks.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    # 1. Load PDF pages
    loader = PyPDFium2Loader(str(path))
    pages = loader.load()

    # 2. Split text into chunks
    # chunk_size=1000 characters per chunk
    # chunk_overlap=200 characters to retain context between chunks
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
        is_separator_regex=False,
    )

    chunks = text_splitter.split_documents(pages)
    
    # Add the source filename to each chunk's metadata for accurate citations later
    for chunk in chunks:
        chunk.metadata["source"] = original_filename if original_filename else path.name

    return chunks 