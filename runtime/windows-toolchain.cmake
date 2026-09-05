# SentencePiece embeds its normalization data. Keep its unused fallback data
# directory independent of the release builder's CMake install prefix.
set(CMAKE_INSTALL_DATADIR "C:/ProgramData/ProjectGraphBridge" CACHE PATH "Public fallback data path" FORCE)
set(SPM_DISABLE_EMBEDDED_DATA OFF CACHE BOOL "Keep normalization data embedded" FORCE)
