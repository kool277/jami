#!/usr/bin/env python3
#
# Copyright (C) 2023 Savoir-faire Linux Inc.
#
# Author: Xavier Jouslin de Noray <xavier.jouslindenoray@savoirfairelinux.com>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
# Creates packaging targets for a distribution and architecture.
# This helps reduce the length of the top Makefile.
#
from os import makedirs, path
import argparse
from typing import Optional, Union, Tuple, Dict, List

import utils
from certificateSigningRequest import CertificateSigningRequest
from certificate import Certificate
from certificateRevocationList import CertificateRevocationList
from pluginCertificate import PluginCertificate
from abstractCertificate import AbstractCertificate
from signature import Signature

def parse() ->argparse.Namespace:
    parser = argparse.ArgumentParser(description='Create a certificate.')
    sub_parser = parser.add_subparsers(dest='subcommand')
    parser.add_argument('save', help='Path to save file', type=str)
    parser.add_argument('--plugin',
                            action='store_true',
                            help='Specified if it\'s a plugin certificate.',
                        )
    parser.add_argument('--archive',
                                  help='Specified if a gz copy is create.',
                                  action='store_true'
                        )
    parser.add_argument('--req',
                          help='Specified if it\'s a certificate request.',
                          action='store_true'
                        )
    revoke_arg_parser = sub_parser.add_parser("revoke")
    revoke_arg_group = revoke_arg_parser.add_argument_group('revoke')
    revoke_arg_group.add_argument('--crl',
                                    help='Specified the path to the CRL.',
                                    required=True,
                                    type=str
                                )
    revoke_arg_group.add_argument('--subject',
                                help='Specified the certificate to be revoked.',
                                required=True,
                                type=str
                            )
    revoke_arg_group.add_argument('--issuer',
                                  help='Specified issuer path to certificate and private key.',
                                  required=True,
                                  type=str
                                )
    revoke_arg_group.add_argument('--reason',
                              help='Specified reason to revoke the certificate.',
                              required=False,
                              type=str
                            )
    verify_arg_parser = sub_parser.add_parser("verify")
    verify_arg_group = verify_arg_parser.add_argument_group('verify')
    verify_arg_group.add_argument('--path',
                                    help='Specified the path to the file to verify',
                                    required=True,
                                    type=str
                                )
    verify_arg_group.add_argument('--issuer',
                                help='Specified issuer path to certificate and private key.',
                                type=str
                            )
    create_arg_parser = sub_parser.add_parser("create")
    create_arg_group = create_arg_parser.add_argument_group('create')
    create_arg_group.add_argument('--subject',
                                  help='Specified subject of a new certificate.',
                                  type=str
                                )
    create_arg_group.add_argument('--issuer',
                                  help='Specified issuer path to certificate and private key.',
                                  type=str
                                )
    create_arg_group.add_argument('--crl',
                                  help='Specified if it\'s crl.',
                                  action='store_true'
                                )
    create_arg_group.add_argument('--organization_config',
                                  help='Specified if it\'s for an organization certificate.',
                                  action='store_true'
                                )

    for arg in ['country', 'state', 'city', 'organization', 'division', 'CRL']:
        create_arg_group.add_argument(f'--{arg}',
                                  help=f'Specified the subject {arg.lower()}.',
                                  type=str
                                )
    sign_arg_parser = sub_parser.add_parser("sign")
    sign_arg_group = sign_arg_parser.add_argument_group('sign')
    sign_arg_group.add_argument('--path',
                                help='Specified the path to the file to sign',
                                required=True,
                                type=str
                            )
    sign_arg_group.add_argument('--issuer',
                                help='Specified issuer path to certificate and private key.',
                                type=str
                            )
    return parser.parse_args()


def create(subject: List[Tuple[str, str]], issuer: Optional[str], is_plugin: bool, is_req: bool, is_crl: bool, is_organization: bool) -> Optional['Certificate']:
    cert = None
    if (len(subject) == 0 and not is_crl) or (is_plugin and utils.isEmpty(issuer)):
        raise ValueError
    if is_organization:
        subject = subject + [('basicConstraints', 'CA:true,pathlen:1')]
    if utils.isEmpty(issuer) and not is_req:
        cert = Certificate.create(subject )
    elif issuer is not None:
        ca = Certificate.load(issuer)
        cert = Certificate.create(subject, ca)
    elif is_req:
        cert = CertificateSigningRequest.create(subject, None)
    if is_crl:
        if issuer is None:
            raise ValueError
        cert = CertificateRevocationList.create(Certificate.load(issuer), [])
    return cert

def sign(path_to_file: str, issuer: str, plugin: bool, req: bool) -> Union[bytes,Dict[str, Dict[str, bytes]]]:
    cert = Certificate.load(issuer)
    if plugin:
        signature = PluginCertificate.load(cert).sign(path_to_file)
    elif req:
        signature = CertificateSigningRequest.load(path_to_file).sign(cert)
    else:
        signature = cert.sign(path_to_file)
    return signature

def verify(path_to_file: str, issuer: str, plugin: bool, req: bool, is_archive: bool) -> bool:
    if plugin:
        return PluginCertificate.verify_from_archive(path_to_file) if is_archive else PluginCertificate.verify(path_to_file)
    if req:
        return CertificateSigningRequest(None, None).verify_from_archive(path_to_file) if is_archive else CertificateSigningRequest.load(path_to_file).verify()
    if not req:
        cert = None
        if is_archive:
            cert = Certificate.load_archive(path_to_file) if issuer is None else Certificate.load(issuer)
        else:
            cert = Certificate.load(path_to_file) if issuer is None else Certificate.load(issuer)
        return cert.verify_from_archive(path_to_file) if is_archive else cert.verify(Certificate.load(path_to_file).cert[1])
    return False

def save(cert: Optional['AbstractCertificate'], signature: Optional['Signature'], save_file: Optional[str], is_plugin: bool, is_csr: bool, is_archive: bool, is_crl) -> None:
    if save_file is None:
        raise ValueError
    path_to_file = path.abspath(path.dirname(save_file))
    if not path.exists(path_to_file):
        makedirs(path_to_file)
    if cert is not None:
        if path.isdir(save_file):
            if is_csr:
                save_file += 'certificate_request'
            elif is_archive:
                save_file += 'archive'
            elif is_crl:
                save_file += 'list'
            else:
                save_file += 'certificate'
        if is_archive:
            cert.save_archive(save_file)
        else:
            cert.save(save_file)
    if signature is not None:
        if path.isdir(save_file):
            if is_plugin:
                save_file += 'plugin.jpl'
            elif is_csr:
                save_file += 'certificate'
            else:
                save_file += 'signature'
        if is_archive:
            signature.save_archive(save_file)
        else:
            signature.save(save_file)

def revoke(crl: str, issuer: str, subject: str, reason: str) -> 'CertificateRevocationList':
    cert = CertificateRevocationList.load(crl, issuer)
    subject = Certificate.load(subject)
    cert.revoke(subject, 'unspecified' if utils.isEmpty(reason) else reason)
    return cert

def main():
    cert = None
    signature = None
    parsed_args = parse()
    if parsed_args.subcommand == 'create':
        subject = [('commonName', parsed_args.subject)]
        for arg in [('country', 'countryName'),
                    ('state', 'stateOrProvinceName'),
                    ('city', 'localityName'),
                    ('organization', 'organizationName'),
                    ('division', 'organizationalUnitName'),
                    ('CRL', 'crlDistributionPoints')]:
            subject.append((arg[1], getattr(parsed_args, arg[0])))
        cert = create(subject, parsed_args.issuer, parsed_args.plugin, parsed_args.req, parsed_args.crl, parsed_args.organization_config)
    elif parsed_args.subcommand == 'revoke':
        all_reason = ['unspecified', 'keyCompromise', 'CACompromise', 'affiliationChanged', 'superseded', 'cessationOfOperation', 'certificateHold']
        if not utils.isEmpty(parsed_args.reason) and not parsed_args.reason in all_reason:
            ValueError
        cert = revoke(parsed_args.crl, parsed_args.issuer, parsed_args.subject, parsed_args.reason)
    elif parsed_args.subcommand == 'sign':
        signature = sign(parsed_args.path, parsed_args.issuer, parsed_args.plugin, parsed_args.req)
    if parsed_args.subcommand == 'verify':
        print("OK" if verify(parsed_args.path, parsed_args.issuer, parsed_args.plugin, parsed_args.req, parsed_args.archive) else "FAIL")
    if not utils.isEmpty(parsed_args.save) and (not signature is None or not cert is None):
        if parsed_args.plugin and parsed_args.subcommand == 'sign':
            cert = Certificate.load(parsed_args.issuer)
            cert = PluginCertificate.load(cert)
        save(cert,
             signature,
             parsed_args.save,
             parsed_args.subcommand == 'sign' and parsed_args.plugin,
             parsed_args.subcommand == 'sign' and parsed_args.req,
             parsed_args.archive,
                parsed_args.subcommand == 'revoke' or parsed_args.subcommand == 'create' and parsed_args.crl
            )

if __name__ == '__main__':
    main()
