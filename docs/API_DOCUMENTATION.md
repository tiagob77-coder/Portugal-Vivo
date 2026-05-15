# API Documentation for Portugal Vivo Backend

## Introduction
This documentation provides a comprehensive overview of the API endpoints for the FastAPI backend of Portugal Vivo. It includes information on authentication, available endpoints, request/response examples, and common error codes.

## Authentication
Authentication is handled via token-based authentication. All requests to protected endpoints must include a valid token in the `Authorization` header.

## Endpoints

### Users

#### Get User Information
- **Method**: GET  
- **URL**: `/users/{user_id}`  
- **Request Parameters**:
  - `user_id`: ID of the user to retrieve  

- **Response**:
  - **Status Code**: 200 OK
  - **Body**:
    ```json
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    }
    ```

#### Create User
- **Method**: POST  
- **URL**: `/users`  
- **Request Body**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com"
  }
  ```
- **Response**:
  - **Status Code**: 201 Created
  - **Body**:
    ```json
    {
      "id": 2,
      "name": "Jane Doe",
      "email": "jane@example.com"
    }
    ```

### Products

#### Get All Products
- **Method**: GET  
- **URL**: `/products`  
- **Response**:
  - **Status Code**: 200 OK
  - **Body**:
    ```json
    [
      {
        "id": 1,
        "name": "Product 1",
        "price": 100.0
      }
    ]
    ```

## Error Codes
- **400**: Bad Request - The request was malformed.
- **401**: Unauthorized - Authentication failed.
- **404**: Not Found - The specified resource could not be found.
- **500**: Internal Server Error - An unexpected error occurred.

## Usage Patterns
An example of a common usage pattern is to first authenticate the user:

### Example of Authentication
```bash
curl -X POST http://api.portugalvivo.com/login \
-H 'Content-Type: application/json' \
-d '{ "username": "user", "password": "pass" }'
```

Then use the token provided in the response for subsequent requests:
```bash
curl -X GET http://api.portugalvivo.com/users/1 \
-H 'Authorization: Bearer <token>'
```

## Conclusion
For any questions regarding the API, please contact our support team.