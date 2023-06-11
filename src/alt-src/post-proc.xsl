<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="xml" indent="yes" />

  <xsl:template name="string-replace">
    <xsl:param name="text" />
    <xsl:param name="replace" />
    <xsl:param name="by" />
    <xsl:choose>
      <xsl:when test="contains($text, $replace)">
        <xsl:value-of select="substring-before($text,$replace)" />
        <xsl:value-of select="$by" />
        <xsl:value-of select="substring-after($text,$replace)" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$text" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- http to https -->
  <xsl:template match="//source/urls/url[starts-with(@src,'http://')]/@src">
    <xsl:attribute name="src">
      <xsl:call-template name="string-replace">
        <xsl:with-param name="text" select="." />
        <xsl:with-param name="replace" select="'http'" />
        <xsl:with-param name="by" select="'https'" />
      </xsl:call-template>
    </xsl:attribute>
  </xsl:template>

  <!-- remove duplicate sources  -->
  <xsl:template match="//source/urls">
    <xsl:copy>
      <xsl:for-each-group select="url" group-by="concat(@name, '|', @src)">
        <xsl:sort select="@name" />
        <xsl:apply-templates select="." />
      </xsl:for-each-group>
    </xsl:copy>
  </xsl:template>

  <xsl:template match="@*|node()">
    <xsl:copy>
      <xsl:apply-templates select="@*|node()" />
    </xsl:copy>
  </xsl:template>
</xsl:stylesheet>
