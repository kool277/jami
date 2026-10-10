from typing import Optional

from signature import Signature
from certificate import Certificate
from abstractCertificate import AbstractCertificate


class CertificateSigningRequestSignature(Signature):
    """
    A class representing a digital signature for certificate signing request.
    """
    def __init__(self, cert: Optional['AbstractCertificate']):
        super().__init__(cert)

    def create(self, req: 'Certificate') -> 'CertificateSigningRequestSignature':
        """
        Sign data with private key, return signature and data
        :param req: certificate signing request to sign
        :return: signature and data
        """
        req_cert = req.cert[1]
        if self._cert.cert[0] is None or req_cert is None:
            raise ValueError
        subject = [(k.decode(), v.decode()) for k, v in req_cert.get_subject().get_components()]
        extension = [(extension.get_short_name().decode(), extension.get_data().decode()) for extension in req_cert.get_extensions()]

        self._signature = Certificate.create(subject + extension, self._cert)
        return self

    def verify(self) -> bool:
        """
        Verify signature
        :return: True if signature is valid, False otherwise
        """
        return self._cert.verify(self._signature.cert[1])

    def save(self, path_2_file: str) -> None:
        """
        Save signature to file
        :param path_2_file: path to file
        """
        if self._signature is None:
            raise ValueError
        self._signature.save(path_2_file)