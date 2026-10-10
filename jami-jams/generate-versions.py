import hashlib
import json
import sys
from pathlib import Path


here = Path(__file__).parent


def read_versions(versions_file: Path) -> dict:
    if not versions_file.exists():
        return {}

    with open(versions_file) as f:
        return json.load(f)


def get_md5_hash(filename: str) -> str:
    md5_hash = hashlib.md5()

    with open(here / "jams" / filename, "rb") as jar:
        md5_hash.update(jar.read())

    return md5_hash.hexdigest()


def generate_versions(class_name: str, version: str, filename: str) -> None:
    versions_file = here / "versions.json"

    versions = read_versions(versions_file)

    versions[class_name] = {
        "version": version,
        "filename": filename,
        "md5": get_md5_hash(filename),
    }

    with open(versions_file, "w") as f:
        json.dump(versions, f, indent=4)


def main() -> None:
    if len(sys.argv) == 2:
        version = sys.argv[1]

        class_to_filename = {
            "net.jami.jams.ca.JamsCA": "libs/cryptoengine.jar",
            "net.jami.jams.authmodule.UserAuthenticationModule": "libs/authentication-module.jar",
            "net.jami.jams.server.Server": "jams-server.jar",
            "net.jami.jams.ad.connector.ADConnector": "libs/ad-connector.jar",
            "net.jami.jams.ldap.connector.LDAPConnector": "libs/ldap-connector.jar",
        }

        for class_name, filename in class_to_filename.items():
            generate_versions(class_name, version, filename)

        return

    if len(sys.argv) != 4:
        print(f"Usage: {sys.argv[0]} (<version> | <class_name> <version> <filename>)")
        sys.exit(1)

    class_name = sys.argv[1]
    version = sys.argv[2]
    filename = sys.argv[3]

    generate_versions(class_name, version, filename)


if __name__ == "__main__":
    main()
