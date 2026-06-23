"""Generate a sample academic transcript PDF for testing the GPA calculator.

Term 1 is the spec's worked example (expected term GPA 3.02). Other terms add
a Withdrawn (W) and more letter grades so the cumulative GPA differs per term.
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

PATH = "samples/sample_transcript.pdf"

TERMS = [
    ("Fall 2022", [
        ("CS101", "Intro to Computer Science", "3", "A"),
        ("MATH201", "Calculus II", "4", "B+"),
        ("ENG100", "English Composition", "3", "B-"),
        ("HIST110", "World History", "3", "C"),
        ("PE100", "Physical Education", "1", "Pass"),
    ]),
    ("Spring 2023", [
        ("CS201", "Data Structures", "4", "A-"),
        ("MATH202", "Linear Algebra", "3", "B"),
        ("PHYS101", "Physics I", "4", "C+"),
        ("ART150", "Drawing", "3", "W"),
    ]),
    ("Fall 2023", [
        ("CS301", "Algorithms", "4", "A"),
        ("CS310", "Databases", "3", "B+"),
        ("STAT200", "Statistics", "3", "A-"),
        ("PHIL101", "Logic", "3", "D+"),
    ]),
]


def draw(c, term_blocks, header):
    width, height = letter
    y = height - 1 * inch
    c.setFont("Helvetica-Bold", 16)
    c.drawString(1 * inch, y, "Springfield University")
    y -= 20
    c.setFont("Helvetica", 11)
    c.drawString(1 * inch, y, "Official Academic Transcript")
    y -= 16
    c.drawString(1 * inch, y, "Student: Jane A. Doe        ID: 00123456")
    y -= 30

    for term_name, courses in term_blocks:
        c.setFont("Helvetica-Bold", 12)
        c.drawString(1 * inch, y, term_name)
        y -= 18
        c.setFont("Helvetica-Bold", 9)
        c.drawString(1.0 * inch, y, "Course")
        c.drawString(1.8 * inch, y, "Title")
        c.drawString(5.3 * inch, y, "Credits")
        c.drawString(6.3 * inch, y, "Grade")
        y -= 4
        c.line(1 * inch, y, 7 * inch, y)
        y -= 14
        c.setFont("Helvetica", 9)
        for code, title, credits, grade in courses:
            c.drawString(1.0 * inch, y, code)
            c.drawString(1.8 * inch, y, title)
            c.drawString(5.4 * inch, y, credits)
            c.drawString(6.4 * inch, y, grade)
            y -= 14
        y -= 16


c = canvas.Canvas(PATH, pagesize=letter)
draw(c, TERMS, None)
c.save()
print("wrote", PATH)
