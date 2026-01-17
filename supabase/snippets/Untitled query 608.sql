UPDATE auth.users 
SET encrypted_password = '$2a$06$sqT1IsdU0sA6n9cItMFB/eSOozwb.puRR0iQBXPj4MQC/Aeu7zsly'
WHERE email LIKE '%@example.com';