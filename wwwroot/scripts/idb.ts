
enum IdbResponseStatus {
    OK,
    ERROR,
    DB_BLOCKED,
    DB_UPGRADE
};

interface IdbDatabaseSchema {
    [key: string]: {
        key: string;
        autoIncrement: boolean;
        indexes?: [{
            name: string,
            keys: string[]
        }]
    };
};

interface IdbResponseBase {
    isSuccess: boolean,
    status: IdbResponseStatus;
    message?: string;
};

interface IdbOpenResponse extends IdbResponseBase {
    db?: IDBDatabase,
};

interface IdbSaveResponse extends IdbResponseBase {
    key?: IDBValidKey;
};

interface IdbLoadResponse<T> extends IdbResponseBase {
    data?: T;
};

interface IdbCountResponse extends IdbResponseBase {
    count?: number;
};

const createDb = (dbName: string, dbVersion: number): Promise<IdbOpenResponse> => {
    return new Promise<IdbOpenResponse>((resolve, reject) => {
        const openRequest = window.indexedDB.open(dbName, dbVersion);

        openRequest.onblocked = (e) => {
            resolve({
                isSuccess: false,
                status: IdbResponseStatus.DB_BLOCKED,
            });
        };

        openRequest.onerror = (e) => {
            resolve({
                isSuccess: false,
                status: IdbResponseStatus.ERROR
            });
        };

        openRequest.onsuccess = (e) => {
            resolve({
                isSuccess: true,
                status: IdbResponseStatus.OK,
                db: openRequest.result
            });
        };

        openRequest.onupgradeneeded = (e) => {
            resolve({
                isSuccess: true,
                status: IdbResponseStatus.DB_UPGRADE,
                db: openRequest.result
            });
        };
    });
};

const createDbTables = (db: IDBDatabase, dbSchema: IdbDatabaseSchema): Promise<IdbResponseBase> => {
    return new Promise<IdbResponseBase>((resolve, reject) => {
        try {
            if (dbSchema) {
                Object.keys(dbSchema).forEach(key => {
                    const data = dbSchema[key];
                    const tblName = key;

                    if (!db.objectStoreNames.contains(tblName)) {
                        const os = db.createObjectStore(tblName, {
                            'keyPath': data.key,
                            'autoIncrement': data.autoIncrement ?? false
                        });

                        data.indexes?.forEach(i => {
                            os.createIndex(i.name, i.keys);
                        });
                    }
                  });
            }

            resolve({
                isSuccess: true,
                status: IdbResponseStatus.OK
            });

        } catch (exc) {
            resolve({
                isSuccess: false,
                status: IdbResponseStatus.ERROR,
                message: 'Failed creating tables',
            });
        }
    });
};

const setupDb = (request: {
    dbName: string,
    dbVersion: number,
    dbSchema: IdbDatabaseSchema
}): Promise<IdbOpenResponse> => {
    return new Promise<IdbOpenResponse>(async (resolve, reject) => {
        const openResponse = await createDb(request.dbName, request.dbVersion);

        if (!openResponse.isSuccess) {
            resolve({
                isSuccess: false,
                status: IdbResponseStatus.ERROR,
                message: 'db not opened'
            });
        } else {
            if (openResponse.status === IdbResponseStatus.DB_UPGRADE) {
                const tableResponse = await createDbTables(openResponse.db, request.dbSchema);

                if (!tableResponse.isSuccess) {
                    resolve({
                        isSuccess: false,
                        status: IdbResponseStatus.ERROR,
                        message: 'db schema not created'
                    })
                }

                resolve({
                    isSuccess: true,
                    status: IdbResponseStatus.OK,
                    db: openResponse.db,
                    message: 'db with screma created successfully'
                });
            } else {
                resolve({
                    isSuccess: false,
                    status: IdbResponseStatus.ERROR,
                    message: 'setup error'
                });
            }
        } 
    });
};

const saveDbData = (request: {
    dbName: string,
    dbVersion: number,
    dbTableName: string,
    dbData: any
}): Promise<IdbSaveResponse> => {
    return new Promise<IdbSaveResponse>(async (resolve, reject) => {
        try {
            const openResponse = await createDb(request.dbName, request.dbVersion);

            if (!openResponse.isSuccess) {
                resolve({
                    isSuccess: false,
                    status: IdbResponseStatus.ERROR,
                    message: 'db not opened'
                });
            }

            const isDataArray = Array.isArray(request.dbData);

            const tx = openResponse.db.transaction([request.dbTableName], "readwrite");
            const os = tx.objectStore(request.dbTableName);

            let ir: IDBRequest;
            if (isDataArray) {
                request.dbData.forEach((obj: any) => {
                    os.add(obj);
                })
            } else {
                ir = os.add(request.dbData);
            }
            
            tx.oncomplete = (e) => {
                resolve({
                    isSuccess: true,
                    status: IdbResponseStatus.OK,
                    key: isDataArray ? undefined : ir.result
                });
            };

            tx.onerror = (e) => {
                resolve({
                    isSuccess: false,
                    status: IdbResponseStatus.ERROR,
                    message: 'idb transaction error'
                });
            }
        } catch (exc) {
            resolve({
                isSuccess: false,
                status: IdbResponseStatus.ERROR,
            });
        }
    });
};

const loadDbData = <T>(request: {
    dbName: string,
    dbVersion: number,
    dbTableName: string,
    dbTableIndex: string,
    filters: (string | number)[],
}): Promise<IdbLoadResponse<T>> => {
    return new Promise<IdbLoadResponse<T>>(async (resolve, reject) => {
        try {
            const openResponse = await createDb(request.dbName, request.dbVersion);

            if (!openResponse.isSuccess) {
                resolve({
                    isSuccess: false,
                    status: IdbResponseStatus.ERROR,
                    message: 'db not opened'
                });
            }

            const tx1 = openResponse.db.transaction([request.dbTableName], "readonly");
            const os1 = tx1.objectStore(request.dbTableName);
            const osi1 = os1.index(request.dbTableIndex);
            const keyRange = IDBKeyRange.only(request.filters);

            const cr = osi1.getAll(keyRange);
            cr.onsuccess = (e: any) => {
                console.log({
                    saze: true,
                    info: 'loadDbData success',
                    r: e.target.result
                });

                resolve({
                    isSuccess: true,
                    status: IdbResponseStatus.OK,
                    data: e.target.result
                });
            };

            cr.onerror = (e) => {
                console.log({
                    saze: true,
                    info: 'loadDbData error',
                    e
                });

                resolve({
                    isSuccess: false,
                    status: IdbResponseStatus.ERROR,
                    message: 'idb transaction error'
                });
            }
        } catch (exc) {
            resolve({
                isSuccess: false,
                status: IdbResponseStatus.ERROR,
            });
        }
    });
};

const countDbData = (request: {
    dbName: string,
    dbVersion: number,
    dbTableName: string,
    dbTableIndex: string,
    filters: (string | number)[],
}): Promise<IdbCountResponse> => {
    return new Promise<IdbCountResponse>(async (resolve, reject) => {
        try {
            const openResponse = await createDb(request.dbName, request.dbVersion);

            if (!openResponse.isSuccess) {
                resolve({
                    isSuccess: false,
                    status: IdbResponseStatus.ERROR,
                    message: 'db not opened'
                });
            }

            const tx1 = openResponse.db.transaction([request.dbTableName], "readonly");
            const os1 = tx1.objectStore(request.dbTableName);
            const osi1 = os1.index(request.dbTableIndex);
            const keyRange = IDBKeyRange.only(request.filters);
            
            const cr = osi1.count(keyRange);
            cr.onsuccess = (e: any) => {
                resolve({
                    isSuccess: true,
                    status: IdbResponseStatus.OK,
                    count: e.target.result
                });
            };

            cr.onerror = (e) => {
                resolve({
                    isSuccess: false,
                    status: IdbResponseStatus.ERROR,
                    message: 'idb transaction error'
                });
            }
        } catch (exc) {
            resolve({
                isSuccess: false,
                status: IdbResponseStatus.ERROR,
            });
        }
    });
}

export { setupDb, saveDbData, countDbData, loadDbData }
