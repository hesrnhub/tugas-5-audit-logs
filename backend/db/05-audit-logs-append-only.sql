USE review_kantin;
GO

CREATE OR ALTER TRIGGER dbo.TR_AUDIT_LOGS_AppendOnly
ON dbo.AUDIT_LOGS
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50010, 'AUDIT_LOGS bersifat append-only.', 1;
END;
GO

IF DATABASE_PRINCIPAL_ID(N'audit_log_append_only') IS NULL
    CREATE ROLE audit_log_append_only;
GO

GRANT SELECT, INSERT ON OBJECT::dbo.AUDIT_LOGS TO audit_log_append_only;
DENY UPDATE, DELETE ON OBJECT::dbo.AUDIT_LOGS TO audit_log_append_only;
GO

DECLARE @ApplicationUser sysname = N'praktikum_user';

IF DATABASE_PRINCIPAL_ID(@ApplicationUser) IS NULL
    THROW 50011, 'Ubah @ApplicationUser agar sesuai dengan DB_USER aplikasi.', 1;

IF NOT EXISTS (
    SELECT 1
    FROM sys.database_role_members AS drm
    INNER JOIN sys.database_principals AS rolePrincipal
        ON rolePrincipal.principal_id = drm.role_principal_id
    INNER JOIN sys.database_principals AS memberPrincipal
        ON memberPrincipal.principal_id = drm.member_principal_id
    WHERE rolePrincipal.name = N'audit_log_append_only'
      AND memberPrincipal.name = @ApplicationUser
)
BEGIN
    DECLARE @AddMemberSql nvarchar(max) =
        N'ALTER ROLE audit_log_append_only ADD MEMBER ' + QUOTENAME(@ApplicationUser) + N';';
    EXEC sys.sp_executesql @AddMemberSql;
END;
GO
