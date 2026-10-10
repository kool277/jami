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

package net.jami.jams.server.servlets.api.image;

import com.google.gson.Gson;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.Part;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.serialization.adapters.GsonFactory;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

@MultipartConfig
@Slf4j
@WebServlet("/api/image/filehandler/*")
public class FileHandlerServlet extends HttpServlet {

    private static final String IMAGES_DIR = "images";
    private static final String SAVE_DIR = "../../../../../" + IMAGES_DIR;

    /**
     * @apiVersion 1.0.0
     * @api {post} /api/image/filehandler/<blueprintName>/<imageType> Upload an image
     * @apiName postImage
     * @apiGroup Images
     * @apiParam {param} blueprintName The name of the blueprint
     * @apiParam {param} imageType 'logo' or 'background'
     * @apiParam {body} image The new logo image or background image
     * @apiSuccess (200) {null} null image uploaded successfully
     * @apiError (400) {null} null missing path info
     * @apiError (500) {null} null contact was unable to be added
     */
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        try {
            String pathInfo = request.getPathInfo();

            if (pathInfo == null || pathInfo.equals("/")) {
                // Handle missing path info
                response.sendError(HttpServletResponse.SC_BAD_REQUEST);
                return;
            }

            String[] pathParts = pathInfo.split("/");

            if (pathParts.length != 3) {
                // Handle wrong number of path elements
                response.sendError(HttpServletResponse.SC_BAD_REQUEST);
                return;
            }

            String blueprintName = pathParts[1];
            String imageType = pathParts[2];

            File imagesFolder = new File(IMAGES_DIR + File.separator + blueprintName);
            if (!imagesFolder.exists()) {
                imagesFolder.mkdirs();
                Paths.get(IMAGES_DIR, blueprintName, "logo").toFile().mkdirs();
                Paths.get(IMAGES_DIR, blueprintName, "background").toFile().mkdirs();
            }

            Part filePart = request.getPart("file"); // Retrieves <input type="file" name="file">
            String fileName = filePart.getSubmittedFileName();
            String ext = fileName.substring(fileName.lastIndexOf(".") + 1);

            for (Part part : request.getParts()) {
                long now = System.currentTimeMillis();
                fileName = now + "." + ext;
                Path path = Paths.get(SAVE_DIR, blueprintName, imageType, fileName);
                part.write(path.toString());
            }

            Map<String, String> map = new HashMap<>();
            String url =
                    "/api/image/filehandler/" + blueprintName + "/" + imageType + "/" + fileName;
            map.put("url", url);

            Gson gson = GsonFactory.createGson();
            response.setStatus(HttpServletResponse.SC_OK);
            response.getWriter().write(gson.toJson(map));
        } catch (Exception e) {
            log.error("Error during file upload: " + e.getMessage());
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().write("Error during file upload: " + e.getMessage());
        }
    }

    /**
     * @apiVersion 1.0.0
     * @api {get} /api/image/filehandler/<blueprintName>/<imageType>/<fileName> Get an image
     * @apiName getImage
     * @apiGroup Images
     * @apiParam {param} blueprintName The name of the blueprint
     * @apiParam {param} imageType 'logo' or 'background'
     * @apiParam {param} fileName The name of the file
     * @apiSuccess (200) {null} null image received successfully
     * @apiError (400) {null} null missing path info
     * @apiError (404) {null} null image not found
     */
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        try {
            String pathInfo = request.getPathInfo();

            if (pathInfo == null || pathInfo.equals("/")) {
                // Handle missing path info
                response.sendError(HttpServletResponse.SC_BAD_REQUEST);
                return;
            }

            String[] pathParts = pathInfo.split("/");

            if (pathParts.length != 4) {
                // Handle wrong number of path elements
                response.sendError(HttpServletResponse.SC_BAD_REQUEST);
                return;
            }

            String blueprintName = pathParts[1];
            String imageType = pathParts[2];
            String fileName = pathParts[3];

            Path imageFilePath = Paths.get(IMAGES_DIR, blueprintName, imageType, fileName);
            if (!imageFilePath.toFile().exists()) {
                response.sendError(HttpServletResponse.SC_NOT_FOUND);
                return;
            }

            byte[] imageData = Files.readAllBytes(imageFilePath);

            String mimeType = Files.probeContentType(imageFilePath);
            if (mimeType == null) {
                mimeType = "application/octet-stream";
            }

            response.setContentType(mimeType);
            response.setHeader("Cache-Control", "public, max-age=31536000");

            try (OutputStream out = response.getOutputStream()) {
                out.write(imageData);
            }
        } catch (IOException e) {
            log.error("FileHandlerServlet: Error while processing request", e);
            response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }
}
