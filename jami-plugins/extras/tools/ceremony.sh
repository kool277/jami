#!/usr/bin/bash

CERT_FILE="store_ca"
KEY_FILE="store_ca.key"

# Set the subject information for the certificate
SUBJECT="Jami Extension Root C.A."
COUNTRY="CA"
STATE="Quebec"
CITY="Montreal"
ORGANIZATION="Savoir-faire Linux Inc."
DIVISION="Jami"
CRL="URI:https://plugins.jami.net/crl/root"

# Create the openssl configuration file
cat > ca.conf  << EOF
x509_extensions = user_crt
req_extensions = v3_req
distinguished_name = req_distinguished_name
[req_distinguished_name]
ST = $STATE
C = $COUNTRY
L = $CITY
O = $ORGANIZATION
OU = $DIVISION
CN = $SUBJECT
[v3_req]

crlDistributionPoints = $CRL
basicConstraints = CA:true
[user_crt]

crlDistributionPoints = $CRL
basicConstraints = CA:true
EOF

# Generate a private key
certtool --generate-privkey --ecc --outfile "$KEY_FILE"

# Generate the certificate signing request (CSR)
openssl req -new -key "$KEY_FILE" -out "$CERT_FILE".csr -subj "/CN=$SUBJECT/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORGANIZATION/OU=$DIVISION" -config ca.conf

# Generate the self-signed certificate using the CSR with SHA-256
openssl x509 -req -in "$CERT_FILE".csr -signkey "$KEY_FILE" -out "$CERT_FILE".crt -days 10950 -extensions user_crt -extfile ca.conf

# Remove the CSR file
rm "$CERT_FILE".csr
rm ca.conf

echo "Self-signed certificate created: $CERT_FILE"
echo "Private key created: $KEY_FILE"
