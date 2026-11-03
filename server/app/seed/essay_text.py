"""Deterministic, plausible student essays for seeded applications (V6).

Seeded approved/submitted essays used to read "Draft in progress." — this module writes a personal statement or study
plan from the student's own profile (nationality, prior education, program, university, language score). It never
invents awards or results beyond what the profile implies. Choices are made with a hash of a stable key, never with
the seed's ``rng``, so the seeded random sequence is unchanged. Rows stay ``is_demo`` like every other seeded record.
"""
from __future__ import annotations

import hashlib

COUNTRY = {
    "VN": ("Vietnam", "Vietnamese", ["Hanoi", "Da Nang", "Can Tho", "Hue", "Hai Phong"]),
    "UZ": ("Uzbekistan", "Uzbek", ["Tashkent", "Samarkand", "Namangan", "Bukhara"]),
    "MN": ("Mongolia", "Mongolian", ["Ulaanbaatar", "Darkhan", "Erdenet"]),
    "NP": ("Nepal", "Nepali", ["Kathmandu", "Pokhara", "Lalitpur", "Biratnagar"]),
    "MM": ("Myanmar", "Burmese", ["Yangon", "Mandalay", "Bago"]),
    "KH": ("Cambodia", "Khmer", ["Phnom Penh", "Siem Reap", "Battambang"]),
    "KZ": ("Kazakhstan", "Kazakh", ["Almaty", "Astana", "Shymkent"]),
    "KG": ("Kyrgyzstan", "Kyrgyz", ["Bishkek", "Osh"]),
    "TJ": ("Tajikistan", "Tajik", ["Dushanbe", "Khujand"]),
    "BD": ("Bangladesh", "Bengali", ["Dhaka", "Chattogram", "Sylhet"]),
    "IN": ("India", "Hindi", ["Pune", "Chennai", "Kolkata", "Jaipur"]),
    "CN": ("China", "Chinese", ["Chengdu", "Harbin", "Qingdao", "Kunming"]),
    "JP": ("Japan", "Japanese", ["Osaka", "Fukuoka", "Sendai"]),
    "TW": ("Taiwan", "Mandarin", ["Taichung", "Kaohsiung", "Tainan"]),
    "ID": ("Indonesia", "Indonesian", ["Bandung", "Surabaya", "Yogyakarta"]),
    "PH": ("the Philippines", "Filipino", ["Cebu", "Davao", "Quezon City"]),
    "TH": ("Thailand", "Thai", ["Chiang Mai", "Khon Kaen", "Bangkok"]),
    "LK": ("Sri Lanka", "Sinhala", ["Colombo", "Kandy", "Galle"]),
    "PK": ("Pakistan", "Urdu", ["Lahore", "Karachi", "Islamabad"]),
}

# field → (what drew them, what they want to learn, a modest experience consistent with prior education)
FIELD = {
    "business": ("how small family businesses survive when big brands arrive",
                 "marketing, organisational behaviour and international trade",
                 "I helped my aunt keep the accounts of her clothing stall and noticed how much a simple customer list changed her sales"),
    "computer_science": ("how the apps my friends use every day are built",
                         "algorithms, operating systems and software engineering",
                         "I taught myself Python from free online courses and wrote a small program that tracks my class timetable"),
    "media_communication": ("how Korean dramas and variety shows are produced for audiences far beyond Korea",
                            "media theory, video production and digital journalism",
                            "I edited the video for our school's annual event and learned how much planning one short clip needs"),
    "international_studies": ("how neighbouring countries in Asia cooperate and compete",
                              "international relations, development and East Asian regional studies",
                              "I took part in my school's model United Nations club and represented Korea in one session"),
    "design": ("how good design makes everyday objects easier to use",
               "visual communication, product design and user research",
               "I designed posters for my school's clubs and started a small sketchbook of product ideas"),
    "economics": ("why prices in my home town changed so quickly in recent years",
                  "microeconomics, development economics and econometrics",
                  "I completed two years of economics courses and wrote a short paper on remittances in my region"),
    "data_science": ("how organisations turn raw data into decisions",
                     "statistics, machine learning and data engineering",
                     "in my previous studies I analysed survey data for a faculty project and cleaned more than two thousand responses"),
    "korean_language": ("how a language carries a culture with it",
                        "Korean grammar, pronunciation and language teaching methods",
                        "I have been studying Korean through evening classes and online lessons for the last two years"),
    "electrical_engineering": ("how power and signals move through the devices around us",
                               "circuit design, semiconductors and embedded systems",
                               "my undergraduate final project was a small solar-powered sensor for measuring soil moisture"),
    "biotechnology": ("how laboratory research becomes medicine and food that people can use",
                      "molecular biology, bioprocess engineering and research methods",
                      "during my master's studies I worked in a laboratory on plant cell cultures and learned careful record keeping"),
}

PRIOR = {"HIGH_SCHOOL": "high school", "ASSOCIATE": "college", "BACHELOR": "university", "MASTER": "my master's programme"}


def _pick(key: str, options: list, salt: str = "") -> object:
    h = int(hashlib.sha256(f"{key}|{salt}".encode()).hexdigest(), 16)
    return options[h % len(options)]


def _language_line(topik: int | None, ielts: float | None, instruction: str) -> str:
    if instruction == "ENGLISH":
        if ielts:
            return f"The program is taught in English; my IELTS score is {ielts:g}, and I will also study Korean so that I can take part in daily life outside class."
        return "The program is taught in English, and I will also take Korean classes so that I can take part in daily life outside class."
    if topik and topik >= 4:
        return f"I hold TOPIK level {topik}, and I will keep studying Korean so that I can follow lectures and write reports confidently."
    if topik:
        return f"I hold TOPIK level {topik}. I know this is only a start, so I plan to take extra Korean classes at the language institute during my first year."
    return "I am still building my Korean, so I will study at the university's language institute before and during my first semester."


def compose(essay_type: str, *, key: str, first_name: str, nationality: str | None, prior_level: str | None, program_name: str,
            field: str, degree: str, instruction: str, university: str, city: str, topik: int | None = None,
            ielts: float | None = None, career_goal: str | None = None, partial: bool = False) -> str:
    """Return a personal statement (``PERSONAL_STATEMENT``) or study plan (``STUDY_PLAN``) of roughly 200–400 words."""
    country, lang, towns = COUNTRY.get(nationality or "", ("my home country", "my first language", ["my home town"]))
    town = _pick(key, towns, "town")
    drew, learn, exp = FIELD.get(field, FIELD["business"])
    prior = PRIOR.get(prior_level or "", "school")
    language = _language_line(topik, ielts, instruction)
    goal = career_goal.strip().rstrip(".") if career_goal else _pick(key, [
        f"work for a company that connects {country} and Korea",
        f"return to {country} and share what I have learned with younger students",
        "build a career in an international team in Korea or in my region",
    ], "goal")
    level_word = {"BACHELOR": "undergraduate", "TRANSFER": "transfer", "MASTER": "master's", "DOCTORATE": "doctoral", "LANGUAGE": "language"}.get(degree, "")

    if essay_type == "STUDY_PLAN":
        paras = [
            f"My study plan for the {program_name} at {university} has three stages: settling in and strengthening my Korean, building a solid base in {learn.split(',')[0]}, and preparing for my career.",
            f"In the first year I will focus on the core courses of the {level_word} curriculum and on language. {language} I will use the university's international student office and buddy programme to adapt quickly to life in {city}.",
            f"In the following semesters I want to go deeper into {learn}. I plan to choose electives that connect to my interest in {drew}, and to join at least one student society or research group so that I learn to work with Korean classmates, not only with other international students.",
            f"Before graduation I will look for an internship or project that lets me use what I have studied. After graduating, I would like to {goal}. I will review this plan every semester with my academic adviser and adjust it if my interests change.",
        ]
    else:
        opening = _pick(key, [
            f"Growing up in {town}, {country}, I became curious about {drew}.",
            f"My interest in {field.replace('_', ' ')} started with a simple question I kept asking in {town}: {drew}.",
            f"I am {first_name}, a student from {town}, {country}, and for several years I have wanted to understand {drew}.",
        ], "open")
        paras = [
            f"{opening} At {prior} I chose subjects that let me explore this, and {exp}.",
            f"I want to study the {program_name} at {university} because it combines {learn} with a strong international community. Studying in {city} would let me learn from Korean and international classmates and see how my field works in practice in Korea.",
            f"{language} Living abroad will not always be easy, but I have learned to plan carefully and ask for help early, and I am used to studying in {lang} and another language at the same time.",
            f"After completing my studies I would like to {goal}. I believe the program at {university} is the right place to build the knowledge and confidence I need for that path.",
        ]
    if partial:
        paras = paras[:2]
    return "\n\n".join(paras)


def body_for(db, essay, *, partial: bool = False) -> str:
    """Compose the body for a seeded ``Essay`` row from its owner's profile and its application's program."""
    from sqlalchemy import select

    from app.models import Program, StudentEducation, StudentLanguage, StudentProfile, University, User
    from app.models.enums import LanguageTest

    user = db.get(User, essay.owner_user_id)
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == essay.owner_user_id))
    prog = db.get(Program, essay.program_id) if essay.program_id else None
    uni = db.get(University, prog.university_id) if prog else None
    langs = db.scalars(select(StudentLanguage).where(StudentLanguage.profile_id == prof.id, StudentLanguage.is_planned.is_(False))).all() if prof else []
    topik = max((int(x.score) for x in langs if x.test == LanguageTest.TOPIK), default=None)
    ielts = max((x.score for x in langs if x.test == LanguageTest.IELTS), default=None)
    edu = db.scalars(select(StudentEducation).where(StudentEducation.profile_id == prof.id)).first() if prof else None
    full = (user.full_name if user else "") or "I"
    nat = prof.nationality if prof else None
    # Vietnamese and Chinese names put the given name last; most others in this dataset put it first.
    first = full.split()[-1] if nat in ("VN", "CN", "TW", "KR") and " " in full else full.split()[0]
    return compose(
        essay.essay_type.value if hasattr(essay.essay_type, "value") else str(essay.essay_type),
        key=f"{user.email if user else essay.owner_user_id}|{uni.slug if uni else ''}|{essay.essay_type}", first_name=first, nationality=nat, prior_level=edu.level if edu else None,
        program_name=prog.name_en if prog else "program", field=prog.field if prog else "business",
        degree=(prog.degree_level.value if hasattr(prog.degree_level, "value") else str(prog.degree_level)) if prog else "BACHELOR",
        instruction=(prog.instruction_language.value if hasattr(prog.instruction_language, "value") else str(prog.instruction_language)) if prog else "KOREAN",
        university=uni.name_en if uni else "the university", city=uni.city if uni else "Korea",
        topik=topik, ielts=ielts, career_goal=prof.career_goal if prof else None, partial=partial,
    )
