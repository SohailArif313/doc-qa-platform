from app.services.pdf_loader import load_and_split_pdf

def main():
    pdf_file_path = "sample.pdf"
    
    print("=" * 50)
    print("Starting PDF Processing Pipeline")
    print("Note: This step uses local CPU processing only.")
    print("No external API or LLM model is called in this step.")
    print("=" * 50)

    try:
        chunks = load_and_split_pdf(pdf_file_path)
        
        print(f"\nTotal chunks created: {len(chunks)}")
        
        if chunks:
            print("\n--- First Chunk Content ---")
            print(chunks[0].page_content)
            
            print("\n--- First Chunk Metadata ---")
            print(chunks[0].metadata)
            
    except Exception as e:
        print(f"\nError: {e}")

if __name__ == "__main__":
    main()