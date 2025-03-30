from PyPDF2 import PdfReader, PdfWriter

def swapPages(arg):
  inputPdf = PdfReader(open(arg.input, 'rb'))
  outputPdf = PdfWriter()

  pagesToSwap : list[int] = [int(pageStr) - 1 for pageStr in arg.pages]

  pdfPagesAtSwappedLocation = {
     pagesToSwap[0]: inputPdf.pages[pagesToSwap[1]],
     pagesToSwap[1]: inputPdf.pages[pagesToSwap[0]]
  }

  for i in range(len(inputPdf.pages)):
    pageToWrite = inputPdf.pages[i]

    if i in pagesToSwap:
       pageToWrite = pdfPagesAtSwappedLocation[i] 

    outputPdf.add_page(pageToWrite)

  with open(arg.output, 'wb') as f:
    outputPdf.write(f)


def keepPages(arg):
  inputPdf = PdfReader(open(arg.input, 'rb'))
  outputPdf = PdfWriter()

  if len(arg.pages) > len(inputPdf.pages):
     raise AssertionError("Number of pages to retain is more than number of pages in PDF")
  
  pagesToRetain : set[int] = set([int(pageStr) - 1 for pageStr in arg.pages])
  
  for i in range(len(inputPdf.pages)):
     if i in pagesToRetain:
        outputPdf.add_page(inputPdf.pages[i])

  with open(arg.output, 'wb') as f:
    outputPdf.write(f)


def removePages(arg):
  inputPdf = PdfReader(open(arg.input, 'rb'))
  outputPdf = PdfWriter()

  if len(arg.pages) > len(inputPdf.pages):
     raise AssertionError("Number of pages to delete is more than number of pages in PDF")
  
  pagesToRemove : set[int] = set([int(pageStr) - 1 for pageStr in arg.pages])

  for i in range(len(inputPdf.pages)):
     if i not in pagesToRemove:
        outputPdf.add_page(inputPdf.pages[i])
        
  with open(arg.output, 'wb') as f:
    outputPdf.write(f)


def mergePDFs(arg):
    outputPdf = PdfWriter()
    for PdfIndex in range(len(arg.inputs)):  # Use arg.inputs here
       currentPdf = PdfReader(open(arg.inputs[PdfIndex], 'rb'))
       for pageIndex in range(len(currentPdf.pages)):
          outputPdf.add_page(currentPdf.pages[pageIndex])

    with open(arg.output, 'wb') as f:
      outputPdf.write(f)
