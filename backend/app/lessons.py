"""
Static lesson / vocabulary content for Filipino Sign Language.
Focus: vocabulary building across Alphabet → Basic → Intermediate.
Videos are placeholders (replace with real FSL video URLs or local files later).
"""

from typing import List, Dict, Optional

# Note: Real FSL signs may differ slightly by region; these are educational approximations
# based on common FSL / ASL-influenced Filipino Sign Language vocabulary.

ALPHABET_LESSONS = [
    {
        "id": i,
        "module": "alphabet",
        "order": i,
        "title": f"Letter {letter}",
        "sign": letter,
        "description": f"Let's learn the sign for letter {letter}! Watch the picture, then try it with your hand.",
        "tips": f"Hold your hand up so the camera can see it. Go slow first — you're doing great!",
        "video_placeholder": f"/assets/signs/{letter.lower()}.mp4",  # placeholder path
        "image_placeholder": f"/assets/signs/{letter.lower()}.gif",
        "difficulty": 1,
        "estimated_minutes": 3,
        "vocabulary": [letter],
    }
    for i, letter in enumerate(
        list("ABCDEFGHIJKLMNOPQRSTUVWXYZ"), 1
    )
]

BASIC_VOCAB = [
    ("Hello / Kamusta", "A friendly wave near the face or temple area.", "Greetings", 1),
    ("Thank You / Salamat", "Touch chin with fingertips then move hand forward and down.", "Manners", 1),
    ("Please / Pakiusap", "Open hand circles on the chest.", "Manners", 1),
    ("Yes / Oo", "Fist nods up and down (like a head nod).", "Responses", 1),
    ("No / Hindi", "Index and middle finger tap together or hand wave side to side.", "Responses", 1),
    ("Sorry / Pasensya", "Fist circles over the heart.", "Manners", 2),
    ("Help / Tulong", "Two fists stacked, bottom one lifts up.", "Needs", 2),
    ("Good / Maganda", "Open hand from chin forward or thumbs up with smile.", "Feelings", 1),
    ("Bad / Masama", "Hand from chin turns downward.", "Feelings", 2),
    ("Love / Mahal", "Hands cross over chest or form a heart shape.", "Feelings", 2),
    ("Friend / Kaibigan", "Index fingers hook together then pull apart.", "People", 2),
    ("Family / Pamilya", "F hands (or open hands) circle around each other.", "People", 2),
    ("School / Paaralan", "Hands clap or 'S' shapes move together.", "Places", 2),
    ("Teacher / Guro", "Hand near forehead then opens (like knowledge).", "People", 2),
    ("Student / Mag-aaral", "Hand near forehead then down to open palm (learning).", "People", 2),
    ("Water / Tubig", "Index finger taps chin or 'W' shape.", "Needs", 1),
    ("Food / Pagkain", "Fingers to mouth like eating.", "Needs", 1),
    ("Home / Bahay", "Fingertips form a roof shape.", "Places", 1),
    ("Mother / Nanay", "Thumb to chin (or open hand).", "People", 1),
    ("Father / Tatay", "Thumb to forehead.", "People", 1),
]

BASIC_LESSONS = []
for idx, (title, desc, category, diff) in enumerate(BASIC_VOCAB, 1):
    BASIC_LESSONS.append(
        {
            "id": 100 + idx,
            "module": "basic",
            "order": idx,
            "title": title,
            "sign": title.split(" / ")[0],
            "description": desc,
            "category": category,
            "tips": "Use natural facial expressions. FSL relies heavily on non-manual signals (face, body).",
            "video_placeholder": f"/assets/signs/basic_{idx}.mp4",
            "image_placeholder": f"https://via.placeholder.com/400x300/0f3460/e94560?text={title.split(' / ')[0].replace(' ', '+')}",
            "difficulty": diff,
            "estimated_minutes": 4,
            "vocabulary": [title],
        }
    )

INTERMEDIATE_PHRASES = [
    ("How are you?", "Sign HOW + YOU with raised eyebrows (question face).", "Conversation", 2),
    ("I am fine", "Point to self + GOOD/FINE + smile and nod.", "Conversation", 2),
    ("What is your name?", "WHAT + NAME + point to the person.", "Introduction", 2),
    ("My name is...", "Point to self + NAME + fingerspell your name.", "Introduction", 2),
    ("Nice to meet you", "NICE + MEET + YOU with friendly face.", "Introduction", 2),
    ("Where is the bathroom?", "WHERE + BATHROOM / TOILET.", "Needs", 3),
    ("I need help", "I + NEED + HELP.", "Needs", 2),
    ("Can you help me?", "HELP + ME + question face.", "Needs", 2),
    ("I don't understand", "I + DON'T-UNDERSTAND (wave hand near forehead).", "Conversation", 3),
    ("Please slow down", "PLEASE + SLOW + DOWN (or repeat slower).", "Conversation", 3),
    ("Thank you very much", "THANK-YOU with bigger motion + smile.", "Manners", 2),
    ("See you later", "SEE + YOU + LATER (or SEE-YOU).", "Farewell", 2),
    ("Good morning", "GOOD + MORNING (sun rising motion).", "Greetings", 2),
    ("Good afternoon", "GOOD + AFTERNOON.", "Greetings", 2),
    ("I love you", "I + LOVE + YOU (or ILY handshape).", "Feelings", 2),
]

INTERMEDIATE_LESSONS = []
for idx, (title, desc, category, diff) in enumerate(INTERMEDIATE_PHRASES, 1):
    INTERMEDIATE_LESSONS.append(
        {
            "id": 200 + idx,
            "module": "intermediate",
            "order": idx,
            "title": title,
            "sign": title,
            "description": desc,
            "category": category,
            "tips": "Facial expression is grammar in sign language. Raise brows for yes/no questions, furrow for wh-questions.",
            "video_placeholder": f"/assets/signs/inter_{idx}.mp4",
            "image_placeholder": f"https://via.placeholder.com/400x300/16213e/e94560?text={title.replace(' ', '+')[:20]}",
            "difficulty": diff,
            "estimated_minutes": 5,
            "vocabulary": [title],
        }
    )


ALL_LESSONS: List[Dict] = ALPHABET_LESSONS + BASIC_LESSONS + INTERMEDIATE_LESSONS

MODULES = {
    "alphabet": {
        "id": "alphabet",
        "title": "Alphabet",
        "subtitle": "FSL Manual Alphabet (A–Z)",
        "description": "Build a solid foundation by mastering every letter handshape. Essential for fingerspelling names and new vocabulary.",
        "icon": "🔤",
        "color": "#e94560",
        "total_lessons": len(ALPHABET_LESSONS),
        "order": 1,
    },
    "basic": {
        "id": "basic",
        "title": "Basic Vocabulary",
        "subtitle": "Everyday Words & Greetings",
        "description": "Learn the most useful Filipino Sign Language words for daily communication: greetings, family, school, feelings and needs.",
        "icon": "👋",
        "color": "#0f3460",
        "total_lessons": len(BASIC_LESSONS),
        "order": 2,
    },
    "intermediate": {
        "id": "intermediate",
        "title": "Intermediate Phrases",
        "subtitle": "Useful Conversations",
        "description": "Combine signs into natural phrases. Practice questions, introductions and common interactions.",
        "icon": "💬",
        "color": "#533483",
        "total_lessons": len(INTERMEDIATE_LESSONS),
        "order": 3,
    },
}


def get_modules() -> List[Dict]:
    return sorted(MODULES.values(), key=lambda m: m["order"])


def get_lessons(module: Optional[str] = None) -> List[Dict]:
    if module:
        return [l for l in ALL_LESSONS if l["module"] == module]
    return ALL_LESSONS


def get_lesson(lesson_id: int) -> Optional[Dict]:
    for l in ALL_LESSONS:
        if l["id"] == lesson_id:
            return l
    return None


def get_module_info(module_id: str) -> Optional[Dict]:
    return MODULES.get(module_id)
