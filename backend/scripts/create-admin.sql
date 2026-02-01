-- Create Admin User: Nick VossAdmin
-- Email: nick@nwvoss.com
-- Password: password123

INSERT INTO users (
  id, 
  email, 
  password_hash, 
  first_name, 
  last_name, 
  role, 
  is_active,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'nick@nwvoss.com',
  '$2b$10$sjxMPsERLbwzc6LHTTAKwO1Ki/4IYULVYgjAV20YItA3j3piNcI9m',
  'Nick',
  'VossAdmin',
  'ADMIN',
  true,
  NOW(),
  NOW()
);

-- Verify the user was created
SELECT id, email, first_name, last_name, role, is_active 
FROM users 
WHERE email = 'nick@nwvoss.com';
