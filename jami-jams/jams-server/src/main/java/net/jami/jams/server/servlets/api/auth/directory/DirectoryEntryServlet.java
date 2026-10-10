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
package net.jami.jams.server.servlets.api.auth.directory;

import static net.jami.jams.server.Server.dataStore;
import static net.jami.jams.server.Server.userAuthenticationModule;

import com.google.gson.Gson;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.authentication.AuthenticationSourceType;
import net.jami.jams.common.authmodule.AuthModuleKey;
import net.jami.jams.common.objects.user.UserProfile;
import net.jami.jams.common.serialization.adapters.GsonFactory;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

// This is an endpoint to manipulate directory entry-data, this make sense only for local setups.

@Slf4j
@WebServlet("/api/auth/directory/entry")
public class DirectoryEntryServlet extends HttpServlet {
    private final Gson gson = GsonFactory.createGson();

    /**
     * @apiVersion 1.0.0
     * @api {get} /api/auth/directory/entry Return the user's profile within a directory
     * @apiName getDirectoryEntry
     * @apiGroup Directory Entries
     * @apiParam {query} [directory] name of the directory
     * @apiParam {query} [directoryType] type of the directory
     * @apiParam {query=vcard} [format=json] output format
     * @apiParam {query} [username] username we are looking for
     * @apiSuccess (200) {body} UserProfile json-representation of the user profile
     * @apiSuccessExample {json} Success-Response: { "username":"jdoe", "firstName":"John",
     *     "lastName":"Doe", "phoneNumber":"+1-514-000-0000", "phoneNumberExtension":"363",
     *     "mobileNumber":"+1-514-000-0000", "faxNumber":"+1-514-000-0000",
     *     "profilePicture":"base64_encoded_picture", "email":"jdoe@savoirfairelinux.com",
     *     "organization":"SFL" }
     * @apiSuccess (200) {body} vCard vcard-representation of the user profile
     * @apiSuccessExample {vCard} Success-Response: BEGIN:VCARD VERSION:3.0 PRODID:ez-vcard 0.10.6
     *     N:B%C3%A9raud;Adrien TEL;TYPE=work:176 EMAIL;TYPE=work:adrien.beraud@savoirfairelinux.com
     *     ORG:Savoir-faire Linux
     *     PHOTO;ENCODING=b;TYPE=jpeg:/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwME
     *     AwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2w
     *     BDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU
     *     FBQUFBQUFBQUFBT/wAARCACWAJYDAREAAhEBAxEB/8QAHgAAAQQCAwEAAAAAAAAAAAAAAAYHCA
     *     kEBQEDCgL/xABEEAABAwMBBAgDBAUKBwAAAAABAgMEAAURBgcSITEIEzhBUWF2tAkUIjJxgaEW
     *     IyRSkRUlM0JiZKSxwdEmN0OElLLx/8QAGwEAAgMBAQEAAAAAAAAAAAAAAAIBAwQFBgf/xAAnEQ
     *     ACAgEEAgIDAAMBAAAAAAAAAQIRAwQSITEyQQUTIlFhFCNxsf/aAAwDAQACEQMRAD8AqqoAKALi
     *     fg6dmXU3q+V7KFWXL5Dx6J2VSMFABQAUAc4oA53FeBoA+eVABigAoAKACgAoAKAPOx0pO01td9
     *     X3f3rtbo+KK32NjTEBQAUAFAFxPwdOzLqb1fK9lCrLl8h49E7KpGCgAoAOdACI2ubVIWyvT6ZS
     *     467jdpaurgW5kZW8rvJ8EjvNUZsqwwurZZCCyPsjbc+kpf1rcflrNvfSclCHsbvkPurzU9dkk7
     *     XB1Y6WNcHVaenc9Z7gzBvK4chs8n88T9/nWjF8lkfaK56Veh5NH9KKw31lDtwQYrTn9G8ynII8
     *     SPCtkPkccnU+DLLTyXQ71nvdv1DCTMtk1mdHUAd9lWceRHca6sJRmri7RlacXTMynICgAoAKAP
     *     Ox0pO01td9X3f3rtbo+KK32NjTEBQAUAFAFxPwdOzLqb1fK9lCrLl8h49E7KpGCgAoA+kpBI3j
     *     hPefAUA+iAHSI2zi4bSL+5b30vhofJNSSd5DLSTx6rjzUcZPlXmtfq2m1H/h2NPhtKxmbouU5Z
     *     Vvyoz5akIO7JdBKc+eOP41walKZ2Y43VpEd16fvF0ffbUpTrbTu8jPHAzyz3iu2pQaTiv4UPFJ
     *     voWWndtFy0LcExb1CnSIycBL7CCUNp8MeVT/AIv3Qbi0mLJOHokr0delijRGo/2h8P2mcQHW1q
     *     wMHkoedNpsstKlGXRz8+JTVrssT07qKBqyzRrpbH0SIj6d5KkKz+FeijNTVo5LTTpmxpxQoAKA
     *     POx0pO01td9X3f3rtbo+KK32NjTEBQAUAFAFxPwdOzLqb1fK9lCrLl8h49E7KpGCgAoAazpI65
     *     c0ds7djRHC1cLqr5VtxJx1aT9o/wAMj8ax6rL9OO/2X4Y75UQzg7NYt9ujE+O2idEiqCpjA+kO
     *     eJB8q8blcm+VZ6TTR5HCuun7bfkJYLPVQkABDQH5VfDGrO0sbSNXC2PafjOEtQUHfOcCrPrUX+
     *     ItL2ZmotklmkWdxhEBkhScHKRSylJKkx4KuCK+2LYBJ0laF3qzOLShlQ32cfZ48CKbDqW8lTXZ
     *     z9VhTtwJl/D72krm2+76LubyzNjstyogVyW2OCsefHNeg0c1LcjzGphtqRMKumYAoAKAPOx0pO
     *     01td9X3f3rtbo+KK32NjTEBQAUAFAFxPwdOzLqb1fK9lCrLl8h49E7KpGCgDlIJIA5mgCvrp5b
     *     aSNZi0sOBLNoHUpGf+oftKNef1Ev8jPsfUTq6eOyG59s1vRq1Im9aFdfDhdcW4QpXjXO1UVDJw
     *     eg0ytWPDa7GX1lTiwyyT9o0m6naOgp+hQtwLfFwVvBahyxwqx7/aFcWzFukaK83usPgK8M1le9
     *     vkeKa5Y3utLYp21zWJSQ426ypPEeVJNcNv0VS/PoYfo7bUI+z/a1p64vvIbYakmMtw8uqWdxQP
     *     4GurhnLFkhL17OBqce+Mki1dLjbzaHWlhxpxIWhaTwIPEGvUHnTmgAoA87HSk7TW131fd/eu1u
     *     j4orfY2NMQFABQAUAXE/B07MupvV8r2UKsuXyHj0TsqkYKAOFvCM048QSGkKXgDJ4DNF1yT3wU
     *     la/eu22LaBeVKdWh6TLdUp5aSQlZUcDHfxrz2KLUt8ket0+nWojKEXVIcTYQxrvZfsNvj7UWNI
     *     uLFyDZanEhTbZOCseOOeKbVvBPOm+qKsEM+LHt7dhr3a9r+MiKIk+6hlxSWC400hCCvGcgEcuP
     *     Pyq7S4ceox7lwass5YuGd1n2ta5tk6BCdFx1e5MQ4pMSC1vSWtzG8pQAwU8edafrTtN0kXffLC
     *     lauxNX3pAa2udt/lG2Ll2+OlS8x1IBcwlRSc8OYIPCpjpYSbgVZNRkcFOK4foU1g23aoctBl3Z
     *     UibGYQgyIq28O7iuG8kY4nj3VyNRghOaxR7Y6yThi+xojDa9ZSWNS3W3vLKd2Utxre+lSTnOPv
     *     8q35tPWKMor0cuGTfKSf7LrOidrtO0LYJpm4Kz81HbMR/PPfT3/nW/A7xo4meO3I0h3a0GcKAP
     *     Ox0pO01td9X3f3rtbo+KK32NjTEBQAUAFAFxPwdOzLqb1fK9lCrLl8h49E7KpGCgDlKt05oAib
     *     te6JECwPXrVmlRutOOmbIgEcWj/WUjxHfisWbFUW4nb+M1TxaiO7p8DbbNLAiboSbbrglx8ylk
     *     yd48VZzgg/hXC1TTkpR/R6nPX3SXo1132RXeYpLab8tEFI3UtyY6VlI7hmmx5ZQVoWMK4sXWwj
     *     Zta9D3+6Xp2X8zLdiCGiQ6AkBIJJCB3DKqpz5cmRbaHjjt7pcjJ6m2YT7Zqq8i2qiyIz8xcpDL
     *     6cBG+cqCVAcsk1ZptS1CpLkdxcW9vRs7Foq4urZbnRocRCFJUpTKytSgk5AGRwrNkk3F/vkz5O
     *     v4Rts2xG4bRrve7zEhLdnyrksRooT9bgLmPpHPlxrqY5S+rHCL9IwazbiSUlTf8A4W/7CdmjGy
     *     TZVY9Otg9e00HZKlcy6oDe/wAq7cIbIpHksk98mxe1YVhQB52OlJ2mtrvq+7+9drdHxRW+xsaY
     *     gKACgAoAuJ+Dp2ZdTer5XsoVZcvkPHonZVIwUAFAGn1m/coukbu7aGW5FwRHUWmnRkL4cRjxxm
     *     ll4uho9og3sh1Nqm53nVbGoLC9aIcVaBEedYLfXHJ3x4HHDlXn9TCOxbe2z1GHVvPPa/SFHqzV
     *     rdvjD5hzqWe9XeaxwVM7UJcWM7qdy8TZvz1rddZacTupa68DcHjjNaoRb4o1wcn0jL0NdhZEtQ
     *     rqp1Ut1RIkOub4JzyrPmhtdxEnKpVQ4Uye2zFkP4A6plbhx5JJrJJ2YsslFWLroENW682G7Xf+
     *     SerlNubjD6kf0aeR5jmfEV6D4/GoQ2/o8t8lqJajKn6RLUnNdc5JxQAUAedjpSdpra76vu/vXa
     *     3R8UVvsbGmICgAoAKALifg6dmXU3q+V7KFWXL5Dx6J2VSMFABQByDunIoAbLbXpSMrSky8sKcb
     *     kxMK6pJG4oKICjjHPvrBq4Jw3fo3aKbjmS/ZFXUTMG9RI7E9r5phxfFKTxx41xHxJNHq4Zkqoa
     *     3aRpmFZW2m7bZ3no6lA74fV9IrXhySfB3dP8goRpq2ddi0rZylm4OoeZmI+lALhIGfI1hyzkpS
     *     M+o1KyOkuB7dnezeZtWnTbNCmCCwI5MicpHWBtJ4Y3cjJNTpNK80qs83rdQscP6yY+jdJW/Q2m
     *     oFltrSUx4rQb3wgJU4QOKlY769TGOyKijyzbfLNxTkBQAUAedjpSdpra76vu/vXa3R8UVvsbGm
     *     ICgAoAKALifg6dmXU3q+V7KFWXL5Dx6J2VSMFABQAUAIbbDfGbdplNvUkKeuK+rTk8gkbxP5Vj
     *     1jrA2dDQq8yILbSoN505dvnLY2qVBVkqjp+0g+Kf8AauJGpVZ3JQp8CBlba2wy43JdDTrQ+pqS
     *     ndKSPwrWlGHXZfiT9icibSZWorp8vbEiQpZH6xKfpFZZ7IXbJnKTfBLfo0a+a2Z6xs+nblhY1R
     *     loyVfaQ8lO8kfccAVq+JW55Y/yzkfIY/xU/wBEzVDBIPMcK7hwjigAoAKAPOx0pO01td9X3f3r
     *     tbo+KK32NjTEBQAUAFAFxPwdOzLqb1fK9lCrLl8h49E7KpGCgD7SjKc8kj+salRb6Ibo0EjUK5
     *     M8RIKCUpJDsgjgMdwrfDTxSuRW5voaTpLvPQrdpW8JJUiNci2+e4JW2sD88Vz9fh34qSOn8e/9
     *     rt+hoLiW7gzvkAjn415+Ea4Z6W00Iu96YtdxO9NtkWWr951lKjj8RWtRTSbRCbsxbTpu32peYc
     *     BiN4dU2E4/hXPy405cIuuuzCuinZW0/QTcVRDjFzQVEefCt/xMPr1G5+00YtVUsEv4Tvg6+cYk
     *     li5NpKRgB5vgccsmvRrTb43F8nkd1cCvYkNSWw404lxChkEVllCUXTGtPo+8UhIUAedjpSdpra
     *     76vu/vXa3R8UVvsbGmICgAoAKALifg6dmXU3q+V7KFWXL5Dx6J3oQpZwkZNVJOTpDXRkiKGgCv
     *     BOM+VaoYkl+RXZrbg+pMOS+tQ3G0EjwHCtNJdCWaXRlvDts+ZeOC8SofjVk+xWJ/bBpVjUWgL1
     *     b5b7ERlSEuNyZKwhttxJBSSo8Bx4VRkh9kHEu0+R4simvRGGDa7hAilMlpRSkYU4n6kHzBHDBr
     *     hSwuLe5HrMWRT5i+zTTCp9wjI51TPhI1VRjTXFNMhtpOHVcvKss+0PtNtss0LIuu0mxy1tqcbh
     *     OGS4rGQCBw/OunoFeTd+jma6e3A1+yVD9iNxhlxA/WA7wHj5V38dpWjyzfNHxp26uWtgcwje3T
     *     5U8lb5BC4iXZL7YU4OB/ro/2rHPFF8jpmalxDqSptQWn94VklBxYydnnY6Unaa2u+r7v712tkf
     *     FCPsbGmICgAoAKALifg6KSnozamyoJ/wCL5XM/3KFVE4uUuB06ROtdxTDBHLhnNaY41FFN2YDe
     *     pRJjyEEgKQQMnvB5U6hTJMDW8lTGm0xkZD0pSUcOeCasgrlZAntWbSlaHtbDbFlMlTSQhIddCA
     *     SPuqyGN5JUheiOe1G8Xva1OgyL5ILVrjqK27RHURHC+4r/AHyPOupgxQxP8uxW5PoLVAyC3vK4
     *     J3Nze+nHdgVZLDimpJrsmOScJJr0cXTT7MF9aSUhW6FAZxnNfPtfFaXO8cfF9HtNFqHqMak+12
     *     JK5ZirQtKeteJCEt54k1x3LdKjqs22qrRfbbaLZJtz8q3uMvJcefjKKcLJ4IJFe7+O00dPFKfs
     *     8VrtT982l0uh4tm+3F521oj6jiL+YQQj5qMnIV5qTWzNgUJXj6Ocm32L9MmLcH5Co29uOJDu6p
     *     BThX41j5umMjkzHmzGbSsoGTnzoqx0b2NdDBkMtYyVgrX4AVRPHuiCdM8/fSfWHekttaWOStXX
     *     c/4x2ljwkKxs6YAoAKACgC3D4RroR0bdShS9xI1ZJUTn+5w6ux8ciSJrXa9tIkMtoO8lxvf41q
     *     28CrgNPNsy31vPLDbSMOKKjjgKifQydnTc7j+kd4hLQCIwe+gHvA76RKkyTD1boNOp5O/ImKZZ
     *     Sc7qE5JohPYT6E8zsztcOHKYUtcjrU7oU4OKPAirnlk2miDFt2h4EOYwsp+tCcfV9lRHLNO8kp
     *     JpOrI/6Nntkt0mJOgXIYJaUphTbfJWcEV535bD/pjNvlcHd+KyVOUF12a3ZrpWTqOcq4zIgRFh
     *     kLKjx31dwFc343SfdlWSXSOh8jqfqhtT5YrLlpebJTcU/rCZS05aJ+nOcjFe6yZYygkvTPHQj+
     *     VmVbNnM5lCyhKMniElXOs+TKaUrHM09HkMW1pElOHm048cisT7IfB03J79rIHAISOXiTVmPsh9
     *     A1dutnSHVn9UhKWgfuGT+ZplFtcCt0ih3pIrS50iNqS08Uq1VdSPu+bdrI1TaGQ3VQAUAFABQB
     *     a78KF4I6Omo0kZSdVSc/8AiQ6ePYrJYy7glt0rC+KUlCQeI4HiP4YrrRVwKX2bG03L5uM6y2rI
     *     wAonw8Kpkv2OuxY2uKkOMKCUpbZRw4cc1nk+KHO+RKStZA447/Oqwo1T4KlOcuIqxAaxxgvA7v
     *     FaDnHjVidCvoRm0i2Nz9MTXVNHdZKVkHnkZ/3rPr8X2YJJmzQ5PrzqxQbP9FI01ou3trVuIUgy
     *     nludxVx4/cMVOjxLDhjETV5fuzSl66OlTqr3PTJaT1cVvIa/t55rP+lXSdOildGwCXGgDvZxVM
     *     uxkbRqUENdYFDGOIqpjCUXc+tmynFfZGSfw5VZh8mRNUJzUN0WzaYsVlRTImKUtR7wnNa/dIqf
     *     VlJm3dJTtw2hhRKlDUVxBJ7/ANpcrBPyYy6ENSEhQAUAFAFqfwq17nR61D4/pTI9pEqyPQrJMS
     *     FuFV2jb5S6F9c2c8eI4j8q62JpRi2VSTs79l89U16e2viW90ZJqMy2yoiPI5ztwk56lrcSORWD
     *     xxWNrguPpDalqCQrPjiquhjtTH3l+Q7/ABoXDFZiPwpEVwSY43lA8UHvFWKSIZ03O0p1eqLGEZ
     *     yOlxY69KxhG6OJrQtqi3LlFbtPjs0WqNSJ1bfBYrSv+aIh3ZTzfJ1SeG4k/ujHGoSqFsdc9m6j
     *     REsNpSEhOBwxWS7dssCWyNwkD+FKyUJt65lsutKyk4OM1EvGxkrYmVyCzZ1uFWXpDwbQknjx/w
     *     Dhq3EuLCfdGnQtVy1G6rO8hkpjtgHgAkcfzJrXDiLf7KpcUimzpBJ3NvW0lPhqW5D/ABTlcyfk
     *     yUIGlJCgAoAKALTPhZLCej1qHx/SiR7SJWjHG42QyS2o5JiXQOpOA+0W97wUORrZj5jQjMHZE+
     *     sytQ7yt15tSMnwzV+oe9QK4cNjqWXP9I85vk8d3vVWRltiijOobaK14C1cgO4VS0SdDtyQ0khB
     *     G9nhS0DMpNxCWd9eB+FTVgITV+qZz8aYzGdUwp1HUI6tO6EpP2j9/KuhjxpxiVX+TNhoWzRLFp
     *     9EltsNoLY5jv76z53+e1jx5O5Fz+ZUtwrBSTyFU7UWHxJuyFHcB4+Rqtr0NXsRWp7ghLzLrTmS
     *     FbihnxqF00N1yImJfkXLU6WclLVvZW+sd2eQ/wBa1QVY7K27ZsNGbz85pzl1m+6rPmeFX1txpF
     *     btsp26Q/8Az/2mep7n7tyuVLtlg31KAUAFABQBaF8LxW70ftQHHH9J5HH/ALSJWrF4iskrrRzM
     *     Avjipo7x+7vrXiVWhX0GzncTGusptIDj620lY7wOI/zqcnFJirnociBHkyy1ugoCT9SlDmPKsm
     *     6mWHbqK4i3oUhKypQ8OQp1yBq7S+/MdQCogE5JNM0ifRub9d1WuEhuOjrlK4YPdSx5INJCti3G
     *     etl4DqlfYKuOT5Vsb6oqrlijdjfLaecilZKAM4Pd91Y83LsshwJOKFR0kJP0g86hclsjh2ON1b
     *     gUN4JycHFS4iJiOv0JanStCt0rPI9xquC/Kiy+BES5sWzy7/DbC03BaWVqyk4UFkgBKu/G6o/j
     *     WyMbhX9Kn3YuNDNlCpCuG602lGabUcLgWD3OymrpCHO33aWfHU1z905XIfZYICoAKACgAoAtO+
     *     FjHW70d9RFJSB+lEgfUP7pErVi6FZIzUqCliS0s7wIIP3Vsx9iv9GFsiSJFkU2sklMkjPiAABR
     *     qOGV4/Y8kZ8IQd0EBIxWEuETqCap6eloZCc5PnWhKuRq4FVp2CjcbzxzSN+xbOi+uBV7ZZSnCG
     *     xk+dEOmTXFn3abe1NuK5CkBUnPBazwAqzJN44JixW5m3upBiP+BTjFVZOUEexGzd8QT1RCFkcD
     *     jIFTBFjEuxd3ZKy3I4q3uJQcCtTjwV3ydeocx1IO8paCnO6fGscPMs9DUaifMjVcdH2A4pBVj+
     *     wFY/8AatuLlOyqXY6+i0YtchZP1OLFVZnZMOymPpBcNve0r1NcvdOVzX2OxA1ABQB//9k= END:VCARD
     * @apiError (500) {null} null was unable to return any authentication sources
     */
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        String directory = req.getParameter("directory");
        String directoryType = req.getParameter("directoryType");

        String format = req.getParameter("format");
        boolean isInVCardFormat = format != null && format.equals("vcard");

        String jamiId = req.getParameter("jamiId");

        String username =
                jamiId != null
                        ? dataStore.getUserDao().getByJamiId(jamiId).get(0).getUsername()
                        : req.getParameter("username");

        if (directory != null && directoryType != null) {
            AuthModuleKey authModuleKey =
                    new AuthModuleKey(
                            directory, AuthenticationSourceType.fromString(directoryType));

            List<UserProfile> userProfiles =
                    userAuthenticationModule
                            .getAuthSources()
                            .get(authModuleKey)
                            .searchUserProfiles(username, "LOGON_NAME", Optional.empty());

            UserProfile userProfile = userProfiles.get(0);
            String result = isInVCardFormat ? userProfile.getAsVCard() : gson.toJson(userProfile);
            resp.getOutputStream().write(result.getBytes());
            resp.flushBuffer();
            return;
        }

        List<UserProfile> userProfiles = new ArrayList<>();
        userAuthenticationModule
                .getAuthSources()
                .values()
                .forEach(
                        v -> {
                            userProfiles.addAll(
                                    v.searchUserProfiles(username, "LOGON_NAME", Optional.empty()));
                        });

        UserProfile userProfile = userProfiles.get(0);
        String result = isInVCardFormat ? userProfile.getAsVCard() : gson.toJson(userProfile);
        resp.getOutputStream().write(result.getBytes());
        resp.flushBuffer();
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        // This should work to modify a profile only in the case of a LOCAL directory.
    }
}
