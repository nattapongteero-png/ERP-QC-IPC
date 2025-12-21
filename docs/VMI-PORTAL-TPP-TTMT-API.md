TPP Code Lookup

  # Get all TPP codes (first 100)
  curl -X GET "https://vmi-portal.bmscloud.in.th/api/external/vendor/lookup/tpp" \
    -H "X-API-Key: YOUR_VENDOR_API_KEY"

  # Search TPP by code
  curl -X GET "https://vmi-portal.bmscloud.in.th/api/external/vendor/lookup/tpp?search=1234567" \
    -H "X-API-Key: YOUR_VENDOR_API_KEY"

  # Search TPP by name
  curl -X GET "https://vmi-portal.bmscloud.in.th/api/external/vendor/lookup/tpp?search=Paracetamol" \
    -H "X-API-Key: YOUR_VENDOR_API_KEY"

  # With pagination (get 50 records, skip first 100)
  curl -X GET "https://vmi-portal.bmscloud.in.th/api/external/vendor/lookup/tpp?limit=50&offset=100" \
    -H "X-API-Key: YOUR_VENDOR_API_KEY"
    
     Example Responses

  TPP Response:
  {
    "success": true,
    "data": [
      {
        "tppCode": "1234567890123",
        "tppName": "Paracetamol 500mg Tablet"
      },
      {
        "tppCode": "1234567890124",
        "tppName": "Amoxicillin 250mg Capsule"
      }
    ],
    "pagination": {
      "total": 1500,
      "limit": 100,
      "offset": 0,
      "hasMore": true
    }
  }


  TTMT Code Lookup

  # Get all TTMT codes (first 100)
  curl -X GET "https://vmi-portal.bmscloud.in.th/api/external/vendor/lookup/ttmt" \
    -H "X-API-Key: YOUR_VENDOR_API_KEY"

  # Search TTMT by code
  curl -X GET "https://vmi-portal.bmscloud.in.th/api/external/vendor/lookup/ttmt?search=TTMT001" \
    -H "X-API-Key: YOUR_VENDOR_API_KEY"

  # Search by active ingredient
  curl -X GET "https://vmi-portal.bmscloud.in.th/api/external/vendor/lookup/ttmt?search=Ginger" \
    -H "X-API-Key: YOUR_VENDOR_API_KEY"

  # Search by trade name with pagination
  curl -X GET "https://vmi-portal.bmscloud.in.th/api/external/vendor/lookup/ttmt?search=HerbalMed&limit=50&offset=0" \
    -H "X-API-Key: YOUR_VENDOR_API_KEY"
    
    TTMT Response:
  {
    "success": true,
    "data": [
      {
        "ttmtCode": "TTMT00001",
        "activeIngredient": "Ginger Root Extract",
        "strength": "500mg",
        "dosageForm": "Capsule",
        "dispensingUnit": "CAP",
        "tradeName": "GingerCap",
        "manufacturer": "Thai Herbal Co.",
        "fsn": "Ginger Root Extract 500mg Capsule",
        "tmtType": "TTMT"
      }
    ],
    "pagination": {
      "total": 250,
      "limit": 100,
      "offset": 0,
      "hasMore": true
    }
  }


