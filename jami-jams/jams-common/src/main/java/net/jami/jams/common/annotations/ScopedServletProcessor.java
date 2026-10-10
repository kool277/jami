/*
 * Copyright (C) 2020-2024 by Savoir-faire Linux
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
package net.jami.jams.common.annotations;

import javassist.ClassPool;
import javassist.CtClass;
import javassist.CtMethod;
import javassist.LoaderClassPath;

import net.jami.jams.common.objects.user.AccessLevel;

import java.io.File;
import java.io.FileInputStream;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.HashMap;
import java.util.Set;

import javax.annotation.processing.AbstractProcessor;
import javax.annotation.processing.RoundEnvironment;
import javax.annotation.processing.SupportedAnnotationTypes;
import javax.annotation.processing.SupportedOptions;
import javax.annotation.processing.SupportedSourceVersion;
import javax.lang.model.SourceVersion;
import javax.lang.model.element.Element;
import javax.lang.model.element.TypeElement;
import javax.tools.Diagnostic;

@SupportedAnnotationTypes("net.jami.jams.common.annotations.ScopedServletMethod")
@SupportedSourceVersion(SourceVersion.RELEASE_11)
@SupportedOptions({"moduleDir", "parentDir"})
// This is a bit of hack to modify already compiled sources at compilation time
public class ScopedServletProcessor extends AbstractProcessor {

    private String moduleDirectory = null;
    private String parentDirectory = null;

    public boolean process(Set<? extends TypeElement> annotations, RoundEnvironment roundEnv) {
        // Get the current project working directory:
        moduleDirectory = processingEnv.getOptions().get("moduleDir");
        parentDirectory = processingEnv.getOptions().get("parentDir");
        processingEnv
                .getMessager()
                .printMessage(Diagnostic.Kind.NOTE, "Project Directory: " + moduleDirectory);
        if (roundEnv.processingOver()) {
            return false;
        }
        processingEnv
                .getMessager()
                .printMessage(
                        Diagnostic.Kind.NOTE,
                        "Working in directory: " + System.getProperty("user.dir"));
        Set<? extends Element> annotatedElements =
                roundEnv.getElementsAnnotatedWith(ScopedServletMethod.class);
        // Inside each annotation, we have a list of stuff.
        HashMap<String, HashMap<String, AccessLevel[]>> annList = new HashMap<>();
        annotatedElements.forEach(
                element -> {
                    processingEnv
                            .getMessager()
                            .printMessage(
                                    Diagnostic.Kind.NOTE,
                                    "Found class: " + element.getEnclosingElement().toString());
                    processingEnv
                            .getMessager()
                            .printMessage(Diagnostic.Kind.NOTE, "Found method: " + element);
                    processingEnv
                            .getMessager()
                            .printMessage(
                                    Diagnostic.Kind.NOTE,
                                    "Found "
                                            + element.getAnnotation(ScopedServletMethod.class)
                                                    .securityGroups()
                                                    .length
                                            + " groups");
                    String clsName = element.getEnclosingElement().toString();
                    String mthName = element.toString();
                    AccessLevel[] levels =
                            element.getAnnotation(ScopedServletMethod.class).securityGroups();
                    annList.putIfAbsent(clsName, new HashMap<>());
                    annList.get(clsName).putIfAbsent(mthName, levels);
                });
        annList.forEach(this::processClass);

        return true;
    }

    private void processClass(String classname, HashMap<String, AccessLevel[]> methodNames) {
        try {

            URL cpUrl1 =
                    new URL(
                            "jar:file:"
                                    + parentDirectory
                                    + File.separator
                                    + "compile-libs/tomcat-embed-core-10.1.19.jar!/");
            URL cpUrl3 =
                    new URL(
                            "jar:file:"
                                    + parentDirectory
                                    + File.separator
                                    + "compile-libs/tomcat-annotations-api-10.1.19.jar!/");

            URLClassLoader cpUrlLoader = new URLClassLoader(new URL[] {cpUrl1, cpUrl3});

            StringBuilder path = new StringBuilder();
            path.append(moduleDirectory);
            path.append(File.separator);
            path.append("target");
            path.append(File.separator);
            path.append("classes");
            path.append(File.separator);
            path.append(classname.replaceAll("\\.", File.separator));
            path.append(".class");
            processingEnv
                    .getMessager()
                    .printMessage(Diagnostic.Kind.MANDATORY_WARNING, "Now processing: " + path);
            ClassPool pool = ClassPool.getDefault();
            // Load tomcat & commons classpath..
            pool.insertClassPath(new LoaderClassPath(cpUrlLoader));
            pool.makeClass(
                    new FileInputStream(
                            parentDirectory
                                    + "/jams-common/target/classes/net/jami/jams/common/objects/user/AccessLevel.class"));
            pool.makeClass(
                    new FileInputStream(
                            parentDirectory
                                    + "/jams-common/target/classes/net/jami/jams/common/serialization/tomcat/TomcatCustomErrorHandler.class"));
            CtClass ctClass = pool.makeClass(new FileInputStream(path.toString()));
            processingEnv
                    .getMessager()
                    .printMessage(Diagnostic.Kind.MANDATORY_WARNING, ctClass.getName());
            // Now that we have the CtClass we copy past
            for (String rawmethodName : methodNames.keySet()) {
                String methodName = rawmethodName.split("\\(")[0];
                for (int i = 0; i < ctClass.getMethods().length; i++) {
                    CtMethod method = ctClass.getMethods()[i];
                    if (method.getName().equals(methodName)) {
                        // Insert code.
                        StringBuilder sb = new StringBuilder();
                        sb.append("{\n");
                        sb.append("boolean allowed = false;\n");
                        sb.append(
                                "net.jami.jams.common.objects.user.AccessLevel level = (net.jami.jams.common.objects.user.AccessLevel) req.getAttribute(\"accessLevel\");\n");
                        for (int j = 0; j < methodNames.get(rawmethodName).length; j++) {
                            sb.append(
                                            "if(level == net.jami.jams.common.objects.user.AccessLevel.valueOf(\"")
                                    .append(methodNames.get(rawmethodName)[j].toString())
                                    .append("\")) allowed = true;\n");
                        }
                        sb.append("if(!allowed){\n");
                        sb.append(
                                "net.jami.jams.common.serialization.tomcat.TomcatCustomErrorHandler.sendCustomError(resp,403,\"You do not have sufficient permissions to access this resource!\");\n");
                        sb.append("return;\n");
                        sb.append("}\n");
                        sb.append("}\n");
                        ctClass.getMethods()[i].insertBefore(sb.toString());
                    }
                }
            }
            // Perist the class before it gets copied into the binary.
            path = new StringBuilder();
            path.append(moduleDirectory);
            path.append(File.separator);
            path.append("target");
            path.append(File.separator);
            path.append("generated-sources");
            ctClass.writeFile(path.toString());
            processingEnv.getMessager().printMessage(Diagnostic.Kind.NOTE, "Saved the class...");
        } catch (Exception e) {
            processingEnv.getMessager().printMessage(Diagnostic.Kind.ERROR, e.getMessage());
        }
    }
    // The only way to modify a file at this point would be to read it, and do a LOT of regex.
}
