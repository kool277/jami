
# Certifying and Adding Your Plugin to Jami

To add your plugin built on Jami, you need to certify it by signing it with keys and certificates.

First, you will generate a unique developer key and certificate, which will be used to create a certificate for each plugin. Then, you will sign your jami plugin archive (.jpl) using the plugin’s certificate key.

After that, you will be able to add your signed plugin to Jami.

## Create a directory to store them:

```bash
mkdir -p jami-plugins/certificate
```

## Install the Required Dependencies

Install the necessary dependencies in a Python environment:

```bash
cd jami-plugins/SDK
pip install -r requirements.txt
pip install -r certificate_requirements.txt
```

## Create the Developer Key and Certificate

Generate a unique developer certificate:

```bash
./certKey.py create --subject <YourName> ../certificate/<YourName>
```

## Create the Plugin Certificate

Use the developer certificate to create a plugin-specific certificate:

```bash
./certKey.py create --issuer ../certificate/<YourName> --subject <YourPlugin> ../certificate/<YourPlugin>
```

## Verify the Certificates

To verify the content of a certificate:

```bash
openssl x509 -in ../certificate/<CertificateName.crt> -text -noout
```

## Sign the Plugin

Sign your plugin archive using the created certificate:

```bash
python3 ./certKey.py --plugin sign --issuer ../certificate/<YourPlugin> --path ../build/<your distribution>/<YourPlugin.jpl> ../build/<YourDistribution>/signed/<YourPluginSigned>
```

## Complete example with developer=Alexandre, plugin=AudioFilter, distribution=x86_64-linux-gnu:

```bash
python3 ./certKey.py create --subject Alexandre ../certificate/Alexandre

python3 ./certKey.py create --issuer ../certificate/Alexandre --subject AudioFilter ../certificate/AudioFilter

python3 ./certKey.py --plugin sign --issuer ../certificate/AudioFilter --path ../build/x86_64-linux-gnu/AudioFilter.jpl ../build/x86_64-linux-gnu/signed/AudioFilterSigned
```

## Display the Signed Files


Verify that the signed archive is generated correctly:

```bash
ls ../build/<YourDistribution>/signed
```

## Add Your Plugin to Jami

You can now add your signed `.jpl` archive to Jami.

>**Note:** On Android, the application verifies that your plugin is not self-signed but signed by the root SFL store CA. To disable this verification, you can set `force=true` in `JamiPluginManager::installPlugin` in `daemon/src/plugin/jamipluginmanager.cpp`. This will bypass the validity check but you still need to sign it.
