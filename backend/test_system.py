import requests
import os
import sys
import time

API_URL = "http://localhost:8000/api/v1"

def run_tests():
    print("Starting system integration tests...")
    
    # 1. Check if backend is alive
    try:
      response = requests.get(f"http://localhost:8000/api/docs")
      if response.status_code == 200:
          print("[PASSED] FastAPI Backend is live.")
      else:
          print(f"[FAILED] Backend returned status code {response.status_code}")
          sys.exit(1)
    except Exception as e:
      print(f"[FAILED] Could not connect to backend: {e}")
      sys.exit(1)

    # 2. Check if a test image exists
    test_image_path = os.path.join(os.path.dirname(__file__), "test_mugshot.jpg")
    if not os.path.exists(test_image_path):
        print(f"[WARNING] Test image 'test_mugshot.jpg' not found. Creating a dummy file for structural checks...")
        # Write dummy byte array to pretend it's a file
        with open(test_image_path, "wb") as f:
            f.write(b"dummy image data")
        
        # We will test the endpoint error handling for dummy data
        print("Testing enrollment error handling with invalid image bytes...")
        with open(test_image_path, 'rb') as f:
            files = {'image': ('test_mugshot.jpg', f, 'image/jpeg')}
            data = {
                'first_name': 'Test',
                'last_name': 'Subject',
                'dob': '1990-01-01',
                'gender': 'Male',
                'nationality': 'Testland',
                'distinguishing_marks': 'Test Mark',
                'charge_category': 'Theft',
                'charge_details': 'Testing system integration',
                'user_id': 'test_officer',
                'reason': 'Automated testing sequence'
            }
            res = requests.post(f"{API_URL}/criminals/enroll", data=data, files=files)
        
        # Should fail with 400 because of invalid face/image bytes
        if res.status_code == 400 and "decoded as an image" in res.json().get('detail', ''):
            print("[PASSED] Correctly validated invalid image bytes.")
        else:
            print(f"[FAILED] Enrollment endpoint response: {res.status_code} - {res.text}")
            
        # Clean up dummy file
        os.remove(test_image_path)
    else:
        # Run real facial matching test if real test_mugshot.jpg is present
        print("Testing enrollment with real face image...")
        with open(test_image_path, 'rb') as f:
            files = {'image': ('test_mugshot.jpg', f, 'image/jpeg')}
            data = {
                'first_name': 'Suspect',
                'last_name': 'Zero',
                'dob': '1985-05-12',
                'gender': 'Male',
                'nationality': 'Ireland',
                'distinguishing_marks': 'Tattoo of a spider on neck',
                'charge_category': 'Cybercrime',
                'charge_details': 'Unauthorized access into system networks',
                'user_id': 'admin_jones',
                'reason': 'Enrollment test for Suspect Zero'
            }
            res = requests.post(f"{API_URL}/criminals/enroll", data=data, files=files)
            
        if res.status_code == 200:
            result = res.json()
            criminal_id = result["criminal_id"]
            print(f"[PASSED] Enrolled real face successfully. Assigned ID: {criminal_id}")
            
            # Now test search/identification
            print("Testing 1:N Identification matching...")
            with open(test_image_path, 'rb') as f_search:
                files_search = {'image': ('test_mugshot.jpg', f_search, 'image/jpeg')}
                search_data = {
                    'tolerance': 0.6,
                    'user_id': 'officer_smith',
                    'reason': 'Identification search test'
                }
                res_search = requests.post(f"{API_URL}/criminals/identify", data=search_data, files=files_search)
                
            if res_search.status_code == 200:
                search_res = res_search.json()
                if search_res["match_found"] and search_res["confidence_score"] > 0.85:
                    print(f"[PASSED] Face matched with {search_res['confidence_score']*100:.2f}% confidence!")
                else:
                    print(f"[FAILED] Matching failed: {search_res}")
            else:
                print(f"[FAILED] Search API failed: {res_search.status_code} - {res_search.text}")

            # Now clean up / expunge record
            print("Testing administrative expungement...")
            expunge_data = {
                'user_role': 'admin',
                'user_id': 'admin_jones',
                'reason': 'Cleanup after testing sequence'
            }
            res_del = requests.delete(f"{API_URL}/criminals/{criminal_id}", data=expunge_data)
            if res_del.status_code == 200:
                print("[PASSED] Administrative profile expungement complete.")
            else:
                print(f"[FAILED] Expungement failed: {res_del.status_code} - {res_del.text}")
        else:
            print(f"[FAILED] Real face enrollment failed: {res.status_code} - {res.text}")

if __name__ == "__main__":
    run_tests()
