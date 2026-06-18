import numpy as np
import face_recognition
import cv2

def extract_face_embedding(image_bytes: bytes) -> list:
    """
    Parses image bytes, runs face detection using dlib/face-recognition,
    extracts a 128-dimensional facial representation, and pads it to
    a 512-dimensional vector to match database constraints and ensure future compatibility.
    """
    # Convert image bytes to a numpy array
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if image is None:
        raise ValueError("The uploaded file could not be decoded as an image. Please verify file integrity.")

    # Convert the image from BGR to RGB (face_recognition uses RGB)
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    # Detect all face coordinates
    face_locations = face_recognition.face_locations(rgb_image)
    if not face_locations:
        raise ValueError("Verification failed: No face detected. Ensure proper lighting and visibility.")

    # Extract 128-dimensional dlib face encoding vectors
    face_encodings = face_recognition.face_encodings(rgb_image, face_locations)
    if not face_encodings:
        raise ValueError("Feature extraction failed: Could not compute facial landmarks.")

    # Select the first detected face as the primary profile
    embedding_128 = face_encodings[0]

    # Pad the 128-D vector to 512-D with zero elements to satisfy the schema blueprint
    embedding_512 = np.zeros(512)
    embedding_512[:128] = embedding_128

    return embedding_512.tolist()
