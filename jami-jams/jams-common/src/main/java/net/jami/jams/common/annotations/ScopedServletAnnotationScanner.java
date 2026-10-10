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
import javassist.bytecode.AnnotationsAttribute;
import javassist.bytecode.AttributeInfo;
import javassist.bytecode.MethodInfo;
import javassist.bytecode.annotation.Annotation;

import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;

@Slf4j
public class ScopedServletAnnotationScanner {
    public void processClasses(String jarFile) {
        try {
            ArrayList<String> classNames = PackageScanner.getClasses(jarFile);
            classNames.parallelStream().forEach(this::processClass);

        } catch (Exception e) {
            log.info("An error occurred while modifying the target class: {}", e.getMessage());
        }
    }

    public void processClass(String className) {
        try {
            className = className.replace("/", ".").replace(".class", "");
            CtClass cc = ClassPool.getDefault().get(className);
            cc.defrost();
            CtMethod[] ctMethods = cc.getMethods();
            boolean classChanged = false;
            for (int i = 0; i < ctMethods.length; i++) {
                MethodInfo minfo = ctMethods[i].getMethodInfo();
                for (AttributeInfo ai : minfo.getAttributes()) {
                    if (ai.getClass().getName().contains("AnnotationsAttribute")) {
                        AnnotationsAttribute aa = (AnnotationsAttribute) ai;

                        for (Annotation a : aa.getAnnotations()) {
                            if (a.getTypeName().equals(JsonContent.class.getName())) {
                                log.info(
                                        "[{}] has secured method {}, modifying method… ",
                                        cc.getSimpleName(),
                                        ctMethods[i].getName());
                                // Build the code block that enforces security.
                                String sb =
                                        "{\n"
                                                +
                                                // So this does not play nice when attempting
                                                // to use hash sets…
                                                "resp.setContentType(\"application/json\");\n"
                                                + "}\n";
                                ctMethods[i].insertBefore(sb);
                                classChanged = true;
                            }
                        }
                    }
                }
            }

            if (classChanged) {
                if (cc.isFrozen()) cc.defrost();
                cc.toClass();
            }

        } catch (Exception e) {
        }
    }
}
